import type { ChatMsg } from "./llm";
import type { PlayerState } from "../shared/ocean";
import { loadDoc, saveDoc } from "./persist";

// Player progress, kept in memory and persisted as one document (Postgres or a JSON file).
// Fine for a single server instance.

type PendingQuiz = { quizId: string; correctIndex: number; explanation: string; topic: string };

type PlayerRecord = {
  state: PlayerState;
  history: ChatMsg[];
  pendingQuiz?: PendingQuiz;
  /** Keys ("speciesId:questionKind") of recently asked quiz questions, to avoid repeats. */
  recentQuiz?: string[];
  turnsSinceReflection: number;
};

const MAX_HISTORY = 40;

let db: Record<string, PlayerRecord> = {};

/** Load saved players; call once before the server starts listening. */
export async function initStore() {
  db = await loadDoc<Record<string, PlayerRecord>>("players", {});
}

const scheduleSave = () => saveDoc("players", db);

function freshState(id: string): PlayerState {
  return {
    id,
    diver: { name: "Diver", suitHue: 0, companionName: "Coral", voiceOn: true },
    xp: 0,
    zoneId: "sunlit",
    discovered: [],
    quiz: { asked: 0, correct: 0 },
    learner: { summary: "New diver. Nothing known yet.", knowledgeLevel: "beginner", interests: [], strengths: [], gaps: [], ageBand: "unknown" },
    updatedAt: new Date().toISOString(),
  };
}

export function getPlayer(id: string): PlayerRecord {
  if (!db[id]) {
    db[id] = { state: freshState(id), history: [], turnsSinceReflection: 0 };
    scheduleSave();
  }
  return db[id];
}

export function updatePlayer(id: string, fn: (rec: PlayerRecord) => void) {
  const rec = getPlayer(id);
  fn(rec);
  if (rec.history.length > MAX_HISTORY) {
    rec.history = rec.history.slice(-MAX_HISTORY);
    // History must start with a user turn.
    while (rec.history.length && rec.history[0].role !== "user") rec.history.shift();
  }
  rec.state.updatedAt = new Date().toISOString();
  scheduleSave();
  return rec;
}

export function resetPlayer(id: string) {
  db[id] = { state: freshState(id), history: [], turnsSinceReflection: 0 };
  scheduleSave();
  return db[id];
}
