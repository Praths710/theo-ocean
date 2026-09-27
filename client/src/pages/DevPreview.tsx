// Dev-only page (/dev-preview?page=dive&zone=sunlit): renders the game or home screen with sample
// player data and no login, for visual testing. Not included in production builds.
import { SessionContext, type SessionValue } from "@/lib/session";
import Dashboard from "./Dashboard";
import Dive from "./Dive";

const q = new URLSearchParams(location.search);
const mock: SessionValue = {
  status: "authed",
  user: { id: "u_preview", username: "preview" },
  aiOnline: false,
  snap: {
    maxZoneIndex: 4,
    state: {
      id: "u_preview", xp: 420, zoneId: q.get("zone") ?? "sunlit", discovered: ["hawksbill", "vaquita"], passedZones: ["sunlit", "twilight", "midnight", "abyss"],
      quiz: { asked: 4, correct: 3 },
      diver: { name: "Maya", suitHue: Number(q.get("hue") ?? 0), companionName: "Coral", voiceOn: false },
      learner: { summary: "New diver. Nothing known yet.", knowledgeLevel: "beginner", interests: [], strengths: [], gaps: [], ageBand: "unknown" },
      updatedAt: new Date().toISOString(),
    },
  },
  login: async () => {}, register: async () => {}, logout: async () => {}, apply: () => {},
};

export default function DevPreview() {
  return <SessionContext.Provider value={mock}>{q.get("page") === "home" ? <Dashboard /> : <Dive />}</SessionContext.Provider>;
}
