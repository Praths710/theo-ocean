import { useEffect, useState } from "react";
import { ArrowDown, Check, RotateCcw, ShieldCheck, X } from "lucide-react";
import { findZone, zones, type Checkpoint, type CheckpointResult } from "@shared/ocean";
import { api, type PlayerSnapshot } from "@/lib/api";
import { oceanAudio } from "@/lib/oceanAudio";

type Props = {
  onClose: () => void;
  onSnapshot: (s: PlayerSnapshot, gained?: number) => void;
  onDiveDeeper: () => void;
  /** Lets the buddy react out loud to the result. */
  onResult: (r: CheckpointResult, zoneName: string) => void;
};

/** Zone checkpoint: one question per species from its card. Passing is the only way to unlock the next zone. */
export default function CheckpointQuiz({ onClose, onSnapshot, onDiveDeeper, onResult }: Props) {
  const [cp, setCp] = useState<Checkpoint | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<CheckpointResult | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setError(""); setCp(null); setStep(0); setAnswers([]); setResult(null);
    api.checkpointStart().then((r) => setCp(r.checkpoint)).catch((e) => setError((e as Error).message));
  };
  useEffect(start, []);

  const zone = cp ? findZone(cp.zoneId) : null;
  const next = zone ? zones[zone.level] : undefined;

  const pick = async (i: number) => {
    if (!cp || busy) return;
    oceanAudio.sfx("click");
    const all = [...answers, i];
    setAnswers(all);
    if (all.length < cp.questions.length) { setTimeout(() => setStep((s) => s + 1), 180); return; }
    setBusy(true);
    try {
      const r = await api.checkpointSubmit(cp.id, all);
      setResult(r);
      onSnapshot(r);
      oceanAudio.sfx(r.passed ? "xp" : "lock");
      onResult(r, zone!.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-backdrop" role="presentation" onClick={onClose}>
      <article className="checkpoint" role="dialog" aria-modal="true" aria-labelledby="cp-title" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <header className="cp-head">
          <span className="cp-badge"><ShieldCheck size={18} /></span>
          <div>
            <span className="eyebrow small">ZONE CHECKPOINT</span>
            <h2 id="cp-title">{zone ? zone.name : "Checkpoint"}</h2>
          </div>
        </header>

        {error && (
          <div className="cp-body">
            <p className="cp-error">{error}</p>
            <button className="play-btn small" onClick={onClose}>Back to the dive</button>
          </div>
        )}

        {!error && !cp && <div className="cp-body"><p className="muted">Preparing questions from your species cards…</p></div>}

        {cp && !result && (
          <div className="cp-body">
            <div className="cp-progress">
              {cp.questions.map((_, i) => <i key={i} className={i < answers.length ? "done" : i === step ? "now" : ""} />)}
              <span>Question {Math.min(step + 1, cp.questions.length)} of {cp.questions.length} · need {cp.passMark} right</span>
            </div>
            <p className="cp-question">{cp.questions[step].question}</p>
            <div className="cp-options">
              {cp.questions[step].options.map((o, i) => (
                <button key={`${step}-${i}`} className={`cp-option ${answers[step] === i ? "picked" : ""}`} disabled={busy} onClick={() => pick(i)}>
                  <b>{"ABCD"[i]}</b><span>{o}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {cp && result && (
          <div className="cp-body">
            <div className={`cp-score ${result.passed ? "pass" : "fail"}`}>
              <strong>{result.score}/{result.total}</strong>
              <span>{result.passed ? (result.unlocked ? `Checkpoint passed! The ${result.unlocked} is open.` : "Checkpoint passed! You've mastered the deepest zone.") : `You needed ${result.passMark}. Review the cards and try again.`}</span>
            </div>
            <ol className="cp-review">
              {cp.questions.map((q, i) => (
                <li key={i} className={result.results[i].correct ? "right" : "wrong"}>
                  <span className="cp-mark">{result.results[i].correct ? <Check size={14} /> : <X size={14} />}</span>
                  <div>
                    <p>{q.question}</p>
                    {!result.results[i].correct && <p className="cp-answer">Answer: {q.options[result.results[i].correctIndex]}</p>}
                    <p className="cp-explain">{result.results[i].explanation}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="cp-actions">
              {result.passed && next ? (
                <button className="play-btn small" onClick={() => { onClose(); onDiveDeeper(); }}><ArrowDown size={16} /> Dive into the {next.name}</button>
              ) : !result.passed ? (
                <button className="play-btn small" onClick={start}><RotateCcw size={15} /> Try again</button>
              ) : null}
              <button className="reset-link" onClick={onClose}>Back to the dive</button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
