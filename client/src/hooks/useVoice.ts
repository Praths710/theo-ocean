import { useCallback, useEffect, useRef, useState } from "react";
import { oceanAudio } from "@/lib/oceanAudio";

// Speech output: server voice (Gemini TTS / ElevenLabs) with mood-driven delivery;
// falls back to the most natural browser voice available.
// Speech input: browser Web Speech API (Chrome, Edge, Safari).

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
      // One utterance per sentence: Chrome silently stops long utterances after ~15s.
      const parts = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
      const voice = pickBrowserVoice();
      const p = MOOD_PROSODY[mood] ?? MOOD_PROSODY.curious;
      const utterances = parts.map((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.voice = voice;
        u.rate = p.rate; u.pitch = p.pitch;
        if (i === parts.length - 1) { u.onend = () => resolve(); u.onerror = () => resolve(); }
        return u;
      });
      setTimeout(() => utterances.forEach((u) => speechSynthesis.speak(u)), 60); // Chrome drops speak() called right after cancel()
    });

  /** Speak one complete line with the given mood. Interrupts anything already playing. */
  const speak = useCallback(async (text: string, mood = "curious") => {
    if (!enabled || !text.trim()) return;
    stopSpeaking();
    const gen = generation.current;
    setTalking(true);
    try {
      // Natural server voice if it answers quickly; otherwise don't keep the player waiting.
      if (Date.now() > serverVoiceSkipUntil.current) {
        const res = await fetch("/api/tts", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mood }), signal: AbortSignal.timeout(9000) }).catch(() => null);
        if (gen !== generation.current) return;
        if (!res || !res.ok || res.status === 204) serverVoiceSkipUntil.current = Date.now() + 60_000; // rest a minute, browser voice meanwhile
        if (res && res.ok && res.status !== 204) {
          const url = URL.createObjectURL(await res.blob());
          if (gen !== generation.current) return;
          await new Promise<void>((resolve) => {
            const el = new Audio(url);
            audio.current = el;
            el.onended = el.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            el.play().catch(() => resolve());
          });
          return;
        }
      }
      await browserSpeak(text, mood, gen);
    } finally {
      if (gen === generation.current) setTalking(false);
    }
  }, [enabled, stopSpeaking]);

  const listen = useCallback((onFinal: (text: string) => void) => {
    if (!Recognition) return false;
    stopSpeaking(); // barge-in: user talking interrupts the companion
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
  }, [stopSpeaking]);

  const stopListening = useCallback(() => recog.current?.stop(), []);

  return { speak, stopSpeaking, speaking, listen, stopListening, listening, interim, canListen: Boolean(Recognition) };
}
