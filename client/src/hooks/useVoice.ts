import { useCallback, useEffect, useRef, useState } from "react";
import { oceanAudio } from "@/lib/oceanAudio";

// Speech output: streamed sentence by sentence through the server voice (Groq Orpheus) with mood-driven delivery;
// falls back to the most natural browser voice available.
// Speech input: recorded audio transcribed by Groq Whisper (accurate, works in Safari),
// with the browser Web Speech API as a fallback.

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const Recognition: (new () => SpeechRecognitionLike) | undefined =
  typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

function pickBrowserVoice() {
  const voices = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 10 : 0) + (/aria|jenny|ava|emma|sonia|libby|michelle|samantha|google us english|google uk english female/i.test(v.name) ? 5 : 0) + (/female/i.test(v.name) ? 2 : 0);
  return en.sort((a, b) => score(b) - score(a))[0] ?? null;
}

const MOOD_PROSODY: Record<string, { rate: number; pitch: number }> = {
  excited: { rate: 1.1, pitch: 1.15 }, amazed: { rate: 0.98, pitch: 1.12 }, playful: { rate: 1.06, pitch: 1.12 },
  curious: { rate: 1.02, pitch: 1.06 }, calm: { rate: 0.92, pitch: 1.0 }, gentle: { rate: 0.95, pitch: 1.04 },
  proud: { rate: 1.05, pitch: 1.1 }, spooky: { rate: 0.9, pitch: 0.95 },
};

export function useVoice(enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const serverVoiceSkipUntil = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const recog = useRef<SpeechRecognitionLike | null>(null);
  const generation = useRef(0);

  const setTalking = (on: boolean) => { setSpeaking(on); oceanAudio.duck(on); };

  const stopSpeaking = useCallback(() => {
    generation.current += 1;
    queue.current = [];
    playing.current = false;
    pending.current = "";
    audio.current?.pause();
    audio.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setTalking(false);
  }, []);

  useEffect(() => { if (!enabled) stopSpeaking(); }, [enabled, stopSpeaking]);
  useEffect(() => { if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices(); }, []);

  const browserSpeak = (text: string, mood: string, gen: number) =>
    new Promise<void>((resolve) => {
      if (typeof speechSynthesis === "undefined" || gen !== generation.current) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = pickBrowserVoice();
      const p = MOOD_PROSODY[mood] ?? MOOD_PROSODY.curious;
      u.rate = p.rate; u.pitch = p.pitch;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      setTimeout(() => speechSynthesis.speak(u), 30); // Chrome drops speak() called right after cancel()
    });

  // ---- Streaming speech: each sentence is voiced as soon as it exists, while the rest is still being written.
  // Every sentence's audio is requested immediately (in parallel) and played in order; any sentence
  // whose server audio is slow or unavailable is read by the browser voice instead, so there's no dead air.
  type Chunk = { text: string; audio: Promise<Blob | null> };
  const queue = useRef<Chunk[]>([]);
  const playing = useRef(false);
  const pending = useRef("");
  const lineMood = useRef("curious");

  const fetchAudio = (text: string, mood: string): Promise<Blob | null> => {
    if (Date.now() < serverVoiceSkipUntil.current) return Promise.resolve(null);
    return fetch("/api/tts", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mood }), signal: AbortSignal.timeout(5000) })
      .then(async (res) => {
        if (!res.ok || res.status === 204) { serverVoiceSkipUntil.current = Date.now() + 60_000; return null; }
        return res.blob();
      })
      .catch(() => null);
  };

  const playBlob = (blob: Blob, gen: number) => new Promise<void>((resolve) => {
    if (gen !== generation.current) return resolve();
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    audio.current = el;
    el.onended = el.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    el.play().catch(() => resolve());
  });

  const pump = useCallback(async () => {
    if (playing.current) return;
    playing.current = true;
    const gen = generation.current;
    setTalking(true);
    while (queue.current.length && gen === generation.current) {
      const c = queue.current.shift()!;
      const blob = await c.audio;
      if (gen !== generation.current) break;
      if (blob) await playBlob(blob, gen);
      else await browserSpeak(c.text, lineMood.current, gen);
    }
    if (gen === generation.current) { playing.current = false; setTalking(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Split into speakable pieces of at most ~190 characters (the fast voice's limit). */
  const pieces = (s: string) => {
    const out: string[] = [];
    let rest = s.trim();
    while (rest.length > 190) {
      const cut = Math.max(rest.lastIndexOf(", ", 190), rest.lastIndexOf(" ", 190));
      out.push(rest.slice(0, cut > 40 ? cut + 1 : 190).trim());
      rest = rest.slice(cut > 40 ? cut + 1 : 190);
    }
    if (rest.trim()) out.push(rest.trim());
    return out;
  };

  const enqueue = (text: string) => {
    for (const p of pieces(text)) queue.current.push({ text: p, audio: fetchAudio(p, lineMood.current) });
    void pump();
  };

  /** Start a new spoken line (interrupts whatever is playing). */
  const beginLine = useCallback((mood = "curious") => {
    stopSpeaking();
    queue.current = [];
    playing.current = false;
    pending.current = "";
    lineMood.current = mood;
  }, [stopSpeaking]);

  const setLineMood = useCallback((mood: string) => { lineMood.current = mood; }, []);

  /** Feed streamed text; complete sentences are voiced immediately. */
  const pushText = useCallback((delta: string) => {
    if (!enabled) return;
    pending.current += delta;
    const re = /[^.!?]*[.!?]+["')\]]*\s+/g;
    let m: RegExpExecArray | null;
    let used = 0;
    while ((m = re.exec(pending.current))) { if (m[0].trim()) enqueue(m[0]); used = re.lastIndex; }
    pending.current = pending.current.slice(used);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Voice whatever is left once the reply has finished streaming. */
  const endLine = useCallback(() => {
    if (enabled && pending.current.trim()) enqueue(pending.current);
    pending.current = "";
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Speak one complete line with the given mood. Interrupts anything already playing. */
  const speak = useCallback(async (text: string, mood = "curious") => {
    if (!enabled || !text.trim()) return;
    beginLine(mood);
    pushText(`${text} `);
    endLine();
  }, [enabled, beginLine, pushText, endLine]);

  // ---- Speech input: record + Whisper (accurate, works in Safari); browser recognition as fallback ----
  const recorder = useRef<{ stop: () => void } | null>(null);
  const whisperOff = useRef(false);

  const listenWhisper = useCallback(async (onFinal: (text: string) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    // Auto-stop: after speech is heard, stop on ~1.3s of silence; give up if nothing said in 7s; hard cap 20s.
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let heard = false; let quietSince = performance.now(); const started = performance.now();
    const timer = window.setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 0.02) { heard = true; quietSince = now; }
      if ((heard && now - quietSince > 1300) || (!heard && now - started > 7000) || now - started > 20000) stop();
    }, 100);

    let stopped = false;
    const stop = () => {
      if (stopped) return; stopped = true;
      clearInterval(timer);
      if (rec.state !== "inactive") rec.stop();
    };
    recorder.current = { stop };
    oceanAudio.duck(true);
    setListening(true);
    setInterim("Listening…");

    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      void ac.close();
      oceanAudio.duck(false);
      recorder.current = null;
      if (!heard) { setListening(false); setInterim(""); return; }
      setInterim("Got it, one sec…");
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        const res = await fetch("/api/stt", { method: "POST", credentials: "same-origin", headers: { "Content-Type": blob.type.split(";")[0] }, body: blob });
        if (res.status === 503) whisperOff.current = true;
        const json = (await res.json().catch(() => ({}))) as { text?: string };
        if (json.text?.trim()) onFinal(json.text.trim());
      } finally {
        setListening(false);
        setInterim("");
      }
    };
    rec.start(250);
  }, []);

  const listen = useCallback((onFinal: (text: string) => void) => {
    const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    if (canRecord && !whisperOff.current) {
      stopSpeaking(); // barge-in: user talking interrupts the companion
      listenWhisper(onFinal).catch(() => { setListening(false); setInterim(""); oceanAudio.duck(false); });
      return true;
    }
    return browserListen(onFinal);
  }, [stopSpeaking, listenWhisper]); // eslint-disable-line react-hooks/exhaustive-deps

  const browserListen = (onFinal: (text: string) => void) => {
    if (!Recognition) return false;
    stopSpeaking();
    recog.current?.abort();
    const r = new Recognition();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      setInterim(text);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      recog.current = null;
      if (finalText.trim()) onFinal(finalText.trim());
    };
    r.onerror = () => { setListening(false); setInterim(""); };
    recog.current = r;
    r.start();
    setListening(true);
    return true;
  };

  const stopListening = useCallback(() => { recorder.current?.stop(); recog.current?.stop(); }, []);

  const canListen = Boolean(Recognition) || (typeof MediaRecorder !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices);
  return { speak, beginLine, setLineMood, pushText, endLine, stopSpeaking, speaking, listen, stopListening, listening, interim, canListen };
}
