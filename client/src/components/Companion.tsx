import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Brain, ChevronDown, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import type { PlayerState, Quiz } from "@shared/ocean";
import { api, streamChat, type PlayerSnapshot } from "@/lib/api";
import { useVoice } from "@/hooks/useVoice";

type Msg =
  | { id: number; role: "you" | "ai" | "note"; text: string; mood?: string }
  | { id: number; role: "quiz"; quiz: Quiz; picked?: number; correctIndex?: number; explanation?: string };
type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;

export type CompanionHandle = {
  /** Tell the companion something happened in the game; it responds out loud. */
  event: (description: string) => void;
  /** Send a question as if the player typed it. */
  ask: (question: string) => void;
  quiz: (speciesId?: string) => void;
  open: () => void;
  toggleMic: () => void;
};

type Props = {
  ref?: Ref<CompanionHandle>;
  state: PlayerState | null;
  aiOnline: boolean;
  focusSpeciesId?: string;
  onSnapshot: (s: PlayerSnapshot, gained?: number) => void;
  onToggleVoice: (on: boolean) => void;
  /** Latest companion line (streams in) + mood, for on-screen subtitles/avatar. */
  onLine?: (line: { text: string; mood: string; speaking: boolean; listening: boolean; thinking: boolean }) => void;
};

let nextId = 1;
export const MOOD_COLORS: Record<string, string> = {
  excited: "#ffd166", amazed: "#9bf6ff", curious: "#77dfd5", playful: "#ff9ecd", calm: "#7fb7ff", gentle: "#b8f2c9", proud: "#ffb86b", spooky: "#b39bff",
};

export default function Companion({ ref, state, aiOnline, focusSpeciesId, onSnapshot, onToggleVoice, onLine }: Props) {
  const voiceOn = state?.diver.voiceOn ?? true;
  const companionName = state?.diver.companionName ?? "Coral";
  const voice = useVoice(voiceOn);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState("curious");
  const [line, setLine] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const pendingEvent = useRef<string | null>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, open]);
  useEffect(() => { onLine?.({ text: line, mood, speaking: voice.speaking, listening: voice.listening, thinking: busy }); }, [line, mood, voice.speaking, voice.listening, busy, onLine]);

  const push = (m: NewMsg) => {
    const msg = { ...m, id: nextId++ } as Msg;
    setMsgs((list) => [...list.slice(-60), msg]);
    return msg.id;
  };

  async function send(message: string, isEvent = false) {
    if (!aiOnline) {
      if (!isEvent) push({ role: "note", text: "The AI companion is offline. Add a free GEMINI_API_KEY to .env and restart the server." });
      return;
    }
    if (busyRef.current) {
      if (isEvent) pendingEvent.current = message; // keep only the latest event
      else setTimeout(() => send(message), 500);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    if (!isEvent) push({ role: "you", text: message });
    const aiId = push({ role: "ai", text: "" });
    voice.stopSpeaking();
    let text = "";
    let replyMood = "curious";
    setLine("");
    try {
      const snap = await streamChat({ message, isEvent, focusSpeciesId }, {
        onMood: (m) => { replyMood = m; setMood(m); },
        onDelta: (delta) => {
          text += delta;
          setLine(text);
          setMsgs((list) => list.map((m) => (m.id === aiId && m.role === "ai" ? { ...m, text: m.text + delta, mood: replyMood } : m)));
        },
      });
      if (snap) onSnapshot(snap);
      void voice.speak(text, replyMood);
    } catch (err) {
      setMsgs((list) => list.map((m) => (m.id === aiId ? { id: aiId, role: "note", text: (err as Error).message } : m)));
      setLine("");
    } finally {
      busyRef.current = false;
      setBusy(false);
      const next = pendingEvent.current;
      pendingEvent.current = null;
      if (next) void send(next, true);
    }
  }

  async function startQuiz(speciesId?: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setOpen(true);
    voice.stopSpeaking();
    const noteId = push({ role: "note", text: `${companionName} is cooking up a question…` });
    try {
      const { quiz, message } = await api.quiz(speciesId);
      setMsgs((list) => list.filter((m) => m.id !== noteId));
      if (!quiz) {
        const text = message ?? "Scan a creature first, then I'll quiz you!";
        push({ role: "ai", text, mood: "playful" });
        setMood("playful");
        setLine(text);
        void voice.speak(text, "playful");
        return;
      }
      push({ role: "quiz", quiz });
      setMood("playful");
      setLine(quiz.question);
      void voice.speak(`Quiz time! ${quiz.question} ${quiz.options.map((o, i) => `${"ABCD"[i]}: ${o}.`).join(" ")}`, "playful");
    } catch (err) {
      setMsgs((list) => list.map((m) => (m.id === noteId ? { id: noteId, role: "note", text: (err as Error).message } : m)));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function answer(msgId: number, quiz: Quiz, idx: number) {
    setMsgs((list) => list.map((m) => (m.id === msgId && m.role === "quiz" ? { ...m, picked: idx } : m)));
    try {
      const r = await api.answer(quiz.id, idx);
      setMsgs((list) => list.map((m) => (m.id === msgId && m.role === "quiz" ? { ...m, correctIndex: r.correctIndex, explanation: r.explanation } : m)));
      const opener = r.correct ? ["Yes! Nailed it!", "Ha, you're good at this!", "Boom. Correct!"][Math.floor(Math.random() * 3)] : ["Ooh, so close!", "Not quite, but good guess!", "Hmm, nope, but here's the cool part."][Math.floor(Math.random() * 3)];
      setMood(r.mood);
      setLine(`${opener} ${r.explanation}`);
      void voice.speak(`${opener} ${r.explanation}`, r.mood);
      onSnapshot(r, r.gained);
    } catch (err) {
      push({ role: "note", text: (err as Error).message });
    }
  }

  const toggleMic = () => {
    if (voice.listening) return voice.stopListening();
    const ok = voice.listen((text) => void send(text));
    if (!ok) push({ role: "note", text: "Voice input isn't supported in this browser. Try Chrome or Edge." });
  };

  useImperativeHandle(ref, () => ({
    event: (d) => void send(d, true),
    ask: (q) => void send(q),
    quiz: (speciesId) => void startQuiz(speciesId),
    open: () => setOpen(true),
    toggleMic,
  }));

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send(text);
  };

  const status = !aiOnline ? "offline" : voice.listening ? "listening…" : voice.speaking ? "talking" : busy ? "thinking…" : "with you";

  return (
    <aside className={`companion ${open ? "is-open" : ""}`} aria-label={`${companionName}, your AI dive buddy`} style={{ ["--mood" as string]: MOOD_COLORS[mood] ?? MOOD_COLORS.curious }}>
      <header className="companion-head" onClick={() => setOpen((o) => !o)}>
        <div className={`companion-orb ${voice.speaking ? "speaking" : ""} ${voice.listening ? "listening" : ""} ${busy ? "thinking" : ""}`} aria-hidden="true"><i /><i /><i /></div>
        <div className="companion-title">
          <strong>{companionName}</strong>
          <span>{status}</span>
        </div>
        <button className="companion-icon" onClick={(e) => { e.stopPropagation(); onToggleVoice(!voiceOn); }} aria-pressed={voiceOn} aria-label={voiceOn ? "Mute voice" : "Unmute voice"}>
          {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button className="companion-icon" aria-label={open ? "Collapse chat" : "Expand chat"}><ChevronDown size={16} style={{ transform: open ? "none" : "rotate(180deg)" }} /></button>
      </header>

      {open && (
        <div className="companion-log" ref={listRef}>
          {msgs.length === 0 && <p className="companion-empty">Talk to {companionName} with the mic, or type below. Ask anything about what's swimming around you!</p>}
          {msgs.map((m) =>
            m.role === "quiz" ? (
              <div key={m.id} className="bubble-quiz">
                <span className="eyebrow small"><Brain size={12} /> QUIZ TIME</span>
                <p>{m.quiz.question}</p>
                <div className="quiz-options">
                  {m.quiz.options.map((o, i) => {
                    const st = m.correctIndex === undefined ? (m.picked === i ? "picked" : "") : i === m.correctIndex ? "right" : m.picked === i ? "wrong" : "";
                    return (
                      <button key={i} className={`quiz-option ${st}`} disabled={m.picked !== undefined} onClick={() => answer(m.id, m.quiz, i)}>
                        <b>{"ABCD"[i]}</b>{o}
                      </button>
                    );
                  })}
                </div>
                {m.explanation && <p className="quiz-explain">{m.explanation}</p>}
              </div>
            ) : (
              <div key={m.id} className={`bubble-msg ${m.role}`}>{m.text || <span className="typing"><i /><i /><i /></span>}</div>
            ),
          )}
          {voice.interim && <div className="bubble-msg you interim">{voice.interim}</div>}
        </div>
      )}

      <div className="companion-actions">
        <button onClick={() => startQuiz()} disabled={busy}><Brain size={13} /> Quiz me</button>
        <button onClick={() => send("What's around us right now? Anything cool I should find?")} disabled={busy || !aiOnline}>What's here?</button>
        <button onClick={() => send("How am I doing? What should I learn next?")} disabled={busy || !aiOnline}>How am I doing?</button>
      </div>

      <form className="companion-input" onSubmit={submit}>
        <button type="button" className={`mic ${voice.listening ? "on" : ""}`} onClick={toggleMic} aria-pressed={voice.listening} aria-label={voice.listening ? "Stop listening" : "Talk"}>
          {voice.listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => setOpen(true)} placeholder={voice.listening ? "Listening…" : `Say something to ${companionName}…`} maxLength={500} />
        <button type="submit" className="send" disabled={!input.trim()} aria-label="Send"><Send size={15} /></button>
      </form>
    </aside>
  );
}
