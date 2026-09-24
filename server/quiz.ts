import { zones, type Species, type Zone } from "../shared/ocean";

// Quizzes are built ONLY from the facts shown on each species card (habitat, threats,
// what helps, status, scientific name, key fact), so every question checks something the
// player actually read. Wrong options are real card facts from other species.

export type BuiltQuiz = { key: string; question: string; options: string[]; correctIndex: number; explanation: string; topic: string; speciesId: string };

const allSpecies = zones.flatMap((z) => z.species.map((s) => ({ s, z })));
const STATUSES = ["Critically endangered", "Endangered", "Vulnerable", "Least concern", "Not evaluated"];

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{5,}/g) ?? []);

/** Wrong answers from other species' cards, skipping any that overlap in meaning with the right one. */
function distractors(species: Species, field: keyof Species, n = 3) {
  const correct = String(species[field]);
  const cw = words(correct);
  const tooSimilar = (v: string) => v.toLowerCase() === correct.toLowerCase() || Array.from(words(v)).filter((w) => cw.has(w)).length >= 1;
  const pool = shuffle(allSpecies.map(({ s }) => String(s[field])).filter((v) => !tooSimilar(v)));
  return Array.from(new Set(pool)).slice(0, n);
}

type Template = { kind: string; build: (s: Species, z: Zone) => Omit<BuiltQuiz, "key" | "speciesId" | "topic" | "correctIndex" | "options"> & { correct: string; wrong: string[] } };

const TEMPLATES: Template[] = [
  { kind: "habitat", build: (s) => ({ question: `Where does the ${s.name} live?`, correct: s.habitat, wrong: distractors(s, "habitat"), explanation: `The ${s.name} lives in ${s.habitat.toLowerCase()}. ${s.fact}` }) },
  { kind: "threats", build: (s) => ({ question: `What is the biggest pressure on the ${s.name}?`, correct: s.threats, wrong: distractors(s, "threats"), explanation: `For the ${s.name}, it's ${s.threats.toLowerCase()}. ${s.action} is what helps.` }) },
  { kind: "action", build: (s) => ({ question: `Which action helps protect the ${s.name}?`, correct: s.action, wrong: distractors(s, "action"), explanation: `${s.action}. That's how we help the ${s.name}, since it's threatened by ${s.threats.toLowerCase()}.` }) },
  { kind: "status", build: (s) => ({ question: `What is the conservation status of the ${s.name}?`, correct: s.status, wrong: shuffle(STATUSES.filter((x) => x !== s.status)).slice(0, 3), explanation: `The ${s.name} is listed as ${s.status.toLowerCase()}. ${s.fact}` }) },
  { kind: "scientific", build: (s) => ({ question: `What is the scientific name of the ${s.name}?`, correct: s.scientific, wrong: distractors(s, "scientific"), explanation: `It's ${s.scientific}. Scientists use that name worldwide so everyone knows exactly which animal they mean.` }) },
  { kind: "fact", build: (s) => ({ question: `Which of these is true about the ${s.name}?`, correct: s.fact, wrong: distractors(s, "fact"), explanation: `${s.fact} ${s.details}` }) },
  { kind: "zone", build: (s, z) => ({ question: `In which ocean zone did you find the ${s.name}?`, correct: `${z.name} (${z.depthLabel})`, wrong: shuffle(zones.filter((o) => o.id !== z.id).map((o) => `${o.name} (${o.depthLabel})`)).slice(0, 3), explanation: `The ${s.name} is in the ${z.name}, ${z.depthLabel} down. ${z.summary.split(". ")[0]}.` }) },
];

/** Zone checkpoint: one card-based question per species in the zone, varied question types. */
export function buildCheckpoint(zoneId: string): Omit<BuiltQuiz, "key">[] {
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const kinds = shuffle(TEMPLATES.filter((t) => t.kind !== "zone"));
  return shuffle(zone.species).map((s, i) => {
    const t = kinds[i % kinds.length];
    const q = t.build(s, zone);
    const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
    return { question: q.question, options, correctIndex: options.indexOf(q.correct), explanation: q.explanation, topic: `${s.name} ${t.kind}`, speciesId: s.id };
  });
}

/**
 * Picks a species the player has already scanned (the focused one if given), then a
 * question type not asked recently. Returns null if nothing has been scanned yet.
 */
export function buildQuiz(opts: { speciesId?: string; zoneId: string; discovered: string[]; recent: string[] }): BuiltQuiz | null {
  const scanned = allSpecies.filter(({ s }) => opts.discovered.includes(s.id));
  if (!scanned.length) return null;
  let pick = scanned.find(({ s }) => s.id === opts.speciesId);
  if (!pick) {
    const inZone = scanned.filter(({ z }) => z.id === opts.zoneId);
    const pool = inZone.length ? inZone : scanned;
    // Prefer species we haven't quizzed recently.
    const fresh = pool.filter(({ s }) => !opts.recent.some((k) => k.startsWith(`${s.id}:`)));
    const from = fresh.length ? fresh : pool;
    pick = from[Math.floor(Math.random() * from.length)];
  }
  const { s, z } = pick;
  const unused = TEMPLATES.filter((t) => !opts.recent.includes(`${s.id}:${t.kind}`));
  const t = shuffle(unused.length ? unused : TEMPLATES)[0];
  const q = t.build(s, z);
  const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
  return { key: `${s.id}:${t.kind}`, question: q.question, options, correctIndex: options.indexOf(q.correct), explanation: q.explanation, topic: `${s.name} ${t.kind}`, speciesId: s.id };
}
