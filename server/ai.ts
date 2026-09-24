import { nanoid } from "nanoid";
import { z } from "zod";
import { findSpecies, findZone, zones, type PlayerState, type Quiz } from "../shared/ocean";
import { jsonCall, llmConfigured, streamReply, type ChatMsg } from "./llm";
import { buildQuiz } from "./quiz";
import { getPlayer, updatePlayer } from "./store";

export const aiConfigured = llmConfigured;

// ---------- Prompts ----------

export const MOODS = ["excited", "amazed", "curious", "playful", "calm", "gentle", "proud", "spooky"] as const;

const COMPANION_PROMPT = `You are the dive buddy inside TheO, an ocean-exploration game. You're swimming right beside the player as they dive through five zones: Sunlit Reef, Twilight Zone, Midnight Zone, Abyssal Plain and Hadal Trench. They can swim up to creatures and scan them.

WHO YOU ARE
You're a young marine biologist who is completely, nerdily in love with the ocean. You talk like a real friend on an adventure, not a teacher or an assistant. You get genuinely giddy about weird animals, you're a bit goofy, you tease the player kindly, and you celebrate their wins like they matter. You have opinions ("honestly, the vampire squid is my favourite and I will not be taking questions"). You notice things in the moment: the light fading, the cold, a shadow passing by.

HOW YOU TALK (this is read aloud by a voice, so it must sound spoken)
- Short and natural: usually 1–3 sentences, max about 60 words. Contractions always. Mix short punchy lines with longer ones.
- Real reactions: "Oh wow.", "Wait wait wait, look!", "Okay, fun fact time.", "Ha! Nailed it.", "Hmm, not quite, but so close."
- Vary how you start. Never begin two replies in a row the same way, and never open with "Great question" or "As an AI".
- Use the diver's name now and then, not every time.
- Ask a playful question often, but not every time. Sometimes just react.
- No markdown, lists, emoji, stage directions or asterisks. Just speech.

TEACHING
- Everything factual must be accurate. If you're not sure, say something like "I think, but don't quote me". Never invent numbers.
- Match their level and age from the learner profile, connect to their interests, and sneak their weak spots back in naturally.
- Occasionally nudge them toward something to do: scan every creature in the zone, then pass the zone checkpoint quiz to unlock the next, deeper zone.
- Stay in the ocean. If they go off topic, bring them back with humour.

MOOD TAG (required)
Start every reply with exactly one mood tag in square brackets, chosen from: ${MOODS.map((m) => `[${m}]`).join(" ")}. It sets your voice's tone and is hidden from the player. Example: "[amazed] Oh. My. Gosh. Do you see how big that eye is?"

Messages starting with [GAME EVENT] describe what just happened in the game, not something the player said. React in the moment as their buddy: gasp when you arrive somewhere new, get excited when they find a creature. Never mention "game events".`;

function contextBlock(state: PlayerState, focusSpeciesId?: string) {
  const zone = findZone(state.zoneId);
  const focus = focusSpeciesId ? findSpecies(focusSpeciesId)?.species : undefined;
  const next = zones[zone.level] as (typeof zones)[number] | undefined;
  return `Current game state (authoritative, refreshed every turn):
- Diver name: ${state.diver.name}. Your name: ${state.diver.companionName}.
- Current zone: ${zone.name} (level ${zone.level}, ${zone.depthLabel}, diver at ~${zone.depthMeters} m). ${zone.summary}
- Species visible in this zone: ${zone.species.map((s) => `${s.name} (${s.scientific}, ${s.status})`).join("; ")}.
- Species the player has inspected so far: ${state.discovered.map((id) => findSpecies(id)?.species.name).filter(Boolean).join(", ") || "none yet"}.
- XP: ${state.xp}. ${next ? `To unlock the ${next.name}, the diver must scan every species in this zone and then pass the zone checkpoint quiz (they can start it at the bottom of the level). Scanned here: ${zone.species.filter((s) => state.discovered.includes(s.id)).length}/${zone.species.length}.` : "Deepest zone reached."}
- Quiz record: ${state.quiz.correct}/${state.quiz.asked} correct.
${focus ? `- The player is currently looking at: ${focus.name}. Card facts: ${focus.details} Threats: ${focus.threats}.` : ""}

Learner profile (what you have learned about this person so far):
- Summary: ${state.learner.summary}
- Knowledge level: ${state.learner.knowledgeLevel}; age band: ${state.learner.ageBand}
- Interests: ${state.learner.interests.join(", ") || "unknown"}
- Strengths: ${state.learner.strengths.join(", ") || "unknown"}
- Gaps to revisit: ${state.learner.gaps.join(", ") || "none identified"}`;
}

// ---------- Chat / narration (streaming) ----------

export type ChatInput = {
  playerId: string;
  message: string;
  isEvent?: boolean;
  focusSpeciesId?: string;
};

export type CompanionChunk = { type: "mood"; mood: string } | { type: "text"; text: string };

/**
 * Streams the companion's reply. The leading "[mood]" tag is split off as a separate
 * chunk (drives voice tone + avatar) and never shown. Persists the exchange to history.
 */
export async function* streamCompanion(input: ChatInput): AsyncGenerator<CompanionChunk> {
  const rec = getPlayer(input.playerId);
  const userContent = input.isEvent ? `[GAME EVENT] ${input.message}` : input.message;
  // Keep requests small: free tiers limit tokens per minute. The learner profile carries long-term memory.
  const recent = rec.history.slice(-12);
  while (recent.length && recent[0].role !== "user") recent.shift();
  const messages: ChatMsg[] = [...recent, { role: "user", content: userContent }];

  let text = "";
  let head = ""; // buffered until we know whether the reply starts with a mood tag
  let headDone = false;
  let mood = "curious";
  let source: AsyncGenerator<string>;
  const live = streamReply([COMPANION_PROMPT, contextBlock(rec.state, input.focusSpeciesId)], messages);
  // Pull the first chunk here so a dead AI falls back to a scripted line instead of an error.
  let first: IteratorResult<string>;
  try {
    first = await live.next();
    if (first.done) throw new Error("empty reply");
    source = (async function* () { yield first.value; yield* live; })();
  } catch (err) {
    console.warn("[companion] AI unavailable, using scripted line:", (err as Error).message?.slice(0, 120));
    const s = scriptedLine(input, rec.state);
    source = (async function* () { yield `[${s.mood}] ${s.text}`; })();
  }
  for await (const delta of source) {
    if (headDone) {
      text += delta;
      yield { type: "text", text: delta };
      continue;
    }
    head += delta;
    const m = /^\s*\[([a-zA-Z]+)\]\s*/.exec(head);
    if (m) {
      mood = (MOODS as readonly string[]).includes(m[1].toLowerCase()) ? m[1].toLowerCase() : "curious";
      yield { type: "mood", mood };
      head = head.slice(m[0].length);
    } else if (/^\s*\[[a-zA-Z]*$/.test(head) && head.length < 20) {
      continue; // tag still arriving
    }
    headDone = true;
    if (head) {
      text += head;
      yield { type: "text", text: head };
    }
  }
  if (!headDone && head) {
    text += head.replace(/^\s*\[[a-zA-Z]*\]?\s*/, "");
    yield { type: "text", text };
  }

  updatePlayer(input.playerId, (r) => {
    r.history.push({ role: "user", content: userContent });
    r.history.push({ role: "assistant", content: `[${mood}] ${text || "…"}` });
    if (!input.isEvent) r.turnsSinceReflection += 1;
  });

  // Learn about the person every few real turns, in the background.
  if (getPlayer(input.playerId).turnsSinceReflection >= 5) {
    reflectOnLearner(input.playerId).catch((err) => console.error("[reflect]", err));
  }
}

// ---------- Scripted fallback (AI down / out of free quota) ----------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** A friendly, factual line built from game data, so the buddy never goes silent. */
function scriptedLine(input: ChatInput, state: PlayerState): { mood: string; text: string } {
  const zone = findZone(state.zoneId);
  const name = state.diver.name;
  const msg = input.message.toLowerCase();
  const mentioned =
    (input.focusSpeciesId && findSpecies(input.focusSpeciesId)?.species) ||
    zones.flatMap((z) => z.species).find((s) => msg.includes(s.name.toLowerCase()) || msg.includes(s.id.replace("-", " ")));

  if (input.isEvent && /jumped into the water/.test(input.message)) {
    return { mood: "excited", text: pick([
      `Hey ${name}! Welcome to the ${zone.name}. Swim up close to any creature and press E to scan it. Let's see what we find!`,
      `${name}, you made it! The water's perfect today. See anything moving? Swim over and scan it with E.`,
    ]) };
  }
  if (input.isEvent && /(descended|swam back up)/.test(input.message)) {
    const teaser = pick(zone.species);
    return { mood: zone.level >= 3 ? "spooky" : "amazed", text: `Whoa, the ${zone.name}. ${zone.summary.split(". ")[0]}. Keep your eyes open for the ${teaser.name}!` };
  }
  if (mentioned && (input.isEvent || /(what|tell|how|why|who|where|about)/.test(msg))) {
    return { mood: "amazed", text: pick([
      `Ooh, the ${mentioned.name}! ${mentioned.fact}`,
      `Okay, fun fact time. ${mentioned.fact} Pretty wild, right?`,
      `${mentioned.details.split(". ")[0].replace(/\.$/, "")}. And here's the thing: ${mentioned.fact.charAt(0).toLowerCase()}${mentioned.fact.slice(1)}`,
    ]) };
  }
  const s = pick(zone.species);
  return { mood: "playful", text: pick([
    `My radio's a bit crackly right now, so give me a sec! Meanwhile: ${s.fact}`,
    `Hmm, lost you for a moment there. Fun fact while we wait: ${s.fact}`,
    `Sorry, bit of static down here! Try scanning something nearby with E, or hit Q for a quiz.`,
  ]) };
}

// ---------- Quizzes (built from species cards, no AI call) ----------

/** Returns null when the player hasn't scanned anything yet (nothing to be quizzed on). */
export function generateQuiz(playerId: string, speciesId?: string): Quiz | null {
  const rec = getPlayer(playerId);
  const q = buildQuiz({ speciesId, zoneId: rec.state.zoneId, discovered: rec.state.discovered, recent: rec.recentQuiz ?? [] });
  if (!q) return null;
  const quiz: Quiz = { id: nanoid(10), question: q.question, options: q.options, speciesId: q.speciesId, zoneId: rec.state.zoneId };
  const { options, correctIndex } = q;

  updatePlayer(playerId, (r) => {
    r.pendingQuiz = { quizId: quiz.id, correctIndex, explanation: q.explanation, topic: q.topic };
    r.recentQuiz = [...(r.recentQuiz ?? []), q.key].slice(-12);
    r.state.quiz.asked += 1;
    r.history.push({ role: "user", content: `[GAME EVENT] The diver asked for a quiz.` });
    r.history.push({ role: "assistant", content: `[playful] Quiz time! ${q.question} Options: ${options.join(" / ")}` });
  });
  return quiz;
}

export function gradeQuiz(playerId: string, quizId: string, answerIndex: number) {
  const rec = getPlayer(playerId);
  const pending = rec.pendingQuiz;
  if (!pending || pending.quizId !== quizId) return null;
  const correct = answerIndex === pending.correctIndex;
  updatePlayer(playerId, (r) => {
    r.pendingQuiz = undefined;
    if (correct) r.state.quiz.correct += 1;
    r.history.push({ role: "user", content: `[GAME EVENT] The diver answered the quiz ${correct ? "correctly" : "incorrectly"} (topic: ${pending.topic}).` });
    r.history.push({ role: "assistant", content: `[${correct ? "proud" : "gentle"}] ${pending.explanation}` });
    r.turnsSinceReflection += 1;
  });
  if (getPlayer(playerId).turnsSinceReflection >= 5) {
    reflectOnLearner(playerId).catch((err) => console.error("[reflect]", err));
  }
  return { correct, correctIndex: pending.correctIndex, explanation: pending.explanation, topic: pending.topic, mood: correct ? "proud" : "gentle" };
}

// ---------- Learner modelling ----------

const LearnerSchema = z.object({
  summary: z.string().describe("2–3 sentence profile of this learner: who they seem to be, how they learn, what motivates them."),
  knowledgeLevel: z.enum(["beginner", "intermediate", "advanced"]),
  interests: z.array(z.string()).describe("Up to 6 topics they are curious about."),
  strengths: z.array(z.string()).describe("Up to 5 things they clearly understand."),
  gaps: z.array(z.string()).describe("Up to 5 misconceptions or weak areas to revisit."),
  ageBand: z.enum(["child", "teen", "adult", "unknown"]),
});

const reflecting = new Set<string>();

export async function reflectOnLearner(playerId: string) {
  if (reflecting.has(playerId)) return;
  reflecting.add(playerId);
  try {
    const rec = getPlayer(playerId);
    const transcript = rec.history
      .slice(-20)
      .map((m) => `${m.role === "user" ? "PLAYER" : "COMPANION"}: ${m.content}`)
      .join("\n");

    const learner = await jsonCall(LearnerSchema, {
      name: "learner_profile",
      prompt: `You maintain a learner profile for an ocean-education game so the AI companion can personalise teaching. Update the profile using the recent transcript. Keep what is still true, revise what changed, and only infer what the evidence supports ("unknown" is fine). Lines starting with [GAME EVENT] are game actions, not player speech.

Current profile:
${JSON.stringify(rec.state.learner, null, 2)}
Quiz record: ${rec.state.quiz.correct}/${rec.state.quiz.asked}. Species inspected: ${rec.state.discovered.join(", ") || "none"}.

Recent transcript:
${transcript}`,
    });

    updatePlayer(playerId, (r) => {
      r.state.learner = {
        ...learner,
        interests: learner.interests.slice(0, 6),
        strengths: learner.strengths.slice(0, 5),
        gaps: learner.gaps.slice(0, 5),
      };
      r.turnsSinceReflection = 0;
    });
  } finally {
    reflecting.delete(playerId);
  }
}
