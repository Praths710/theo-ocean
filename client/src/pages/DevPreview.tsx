// Dev-only page (/dev-preview?page=dive&zone=sunlit): renders the game or home screen with sample
// player data and no login, for visual testing. Not included in production builds.
import { SessionContext, type SessionValue } from "@/lib/session";
import Dashboard from "./Dashboard";
import Dive from "./Dive";
import DiverStage from "@/three/DiverStage";
import { DIVER_PRESETS } from "@shared/ocean";

const q = new URLSearchParams(location.search);
const mock: SessionValue = {
  status: "authed",
  user: { id: "u_preview", username: "preview" },
  aiOnline: false,
  snap: {
    maxZoneIndex: q.has("fresh") ? 0 : 4,
    state: {
      id: "u_preview", xp: 420, zoneId: q.get("zone") ?? "sunlit", discovered: ["hawksbill", "vaquita"], passedZones: q.has("fresh") ? [] : ["sunlit", "twilight", "midnight", "abyss"],
      quiz: { asked: 4, correct: 3 },
      diver: { name: "Maya", suitHue: Number(q.get("hue") ?? 0), companionName: "Coral", voiceOn: false },
      learner: { summary: "New diver. Nothing known yet.", knowledgeLevel: "beginner", interests: [], strengths: [], gaps: [], ageBand: "unknown" },
      updatedAt: new Date().toISOString(),
    },
  },
  login: async () => {}, register: async () => {}, logout: async () => {}, apply: () => {},
};

export default function DevPreview() {
  if (q.get("page") === "diver") {
    // Big side-on diver for checking the pose (?yaw=0 side, ?yaw=-0.45 three-quarter).
    return <div style={{ position: "fixed", inset: 0, background: "#0b3550" }}><DiverStage look={DIVER_PRESETS[Number(q.get("preset") ?? 2)].look} length={Number(q.get("len") ?? 4.6)} yaw={Number(q.get("yaw") ?? 0)} /></div>;
  }
  return <SessionContext.Provider value={mock}>{q.get("page") === "home" ? <Dashboard /> : <Dive />}</SessionContext.Provider>;
}
