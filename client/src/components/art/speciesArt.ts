import type { Art } from "./Creature";

export type Behavior = "cruise" | "dart" | "hover" | "floor" | "drift";

/**
 * Visual + movement settings per species. Colours follow each animal's real appearance
 * (`body` = back, `belly` = underside, `accent` = markings/outline, `glow` = bioluminescence).
 * `band` = vertical range as a fraction of screen height.
 */
export const speciesArt: Record<string, { art: Art; width: number; behavior: Behavior; band: [number, number]; speed: number }> = {
  vaquita: { art: { kind: "porpoise", body: "#7d8a93", belly: "#dfe4e7", accent: "#1c2328" }, width: 200, behavior: "cruise", band: [0.2, 0.55], speed: 55 },
  hawksbill: { art: { kind: "turtle", body: "#7a4a1c", belly: "#e3c690", accent: "#2a1606" }, width: 190, behavior: "cruise", band: [0.35, 0.7], speed: 32 },
  whale: { art: { kind: "whale", body: "#56748c", belly: "#c7d5de", accent: "#16263a" }, width: 560, behavior: "cruise", band: [0.08, 0.3], speed: 22 },
  "green-turtle": { art: { kind: "greenturtle", body: "#5b5a34", belly: "#dbd4a2", accent: "#232311" }, width: 180, behavior: "cruise", band: [0.5, 0.8], speed: 28 },

  lanternfish: { art: { kind: "lanternfish", body: "#2c3a4a", belly: "#bccbd8", accent: "#0a121c", glow: "#7ff9ff" }, width: 90, behavior: "dart", band: [0.2, 0.6], speed: 80 },
  swordfish: { art: { kind: "swordfish", body: "#39334f", belly: "#c9d1d9", accent: "#141121" }, width: 280, behavior: "dart", band: [0.15, 0.45], speed: 110 },
  "vampire-squid": { art: { kind: "vampire", body: "#5c1422", belly: "#2e0911", accent: "#180307", glow: "#7fd8ff" }, width: 180, behavior: "hover", band: [0.45, 0.75], speed: 14 },
  siphonophore: { art: { kind: "siphonophore", body: "#d2eaff", belly: "#9fbcff", glow: "#b8a0ff" }, width: 70, behavior: "drift", band: [0.1, 0.35], speed: 8 },

  anglerfish: { art: { kind: "angler", body: "#2b2621", belly: "#15120e", accent: "#070605", glow: "#d8fbff" }, width: 160, behavior: "hover", band: [0.4, 0.75], speed: 12 },
  "sperm-whale": { art: { kind: "sperm", body: "#4a4b53", belly: "#71727b", accent: "#141519" }, width: 520, behavior: "cruise", band: [0.06, 0.25], speed: 26 },
  "gulper-eel": { art: { kind: "eel", body: "#1d1921", belly: "#0c0a0e", accent: "#050406", glow: "#ff5fa8" }, width: 240, behavior: "drift", band: [0.3, 0.6], speed: 18 },
  "giant-squid": { art: { kind: "squid", body: "#b0463d", belly: "#7a2a24", accent: "#3a0e0a" }, width: 320, behavior: "cruise", band: [0.55, 0.8], speed: 20 },

  "dumbo-octopus": { art: { kind: "octopus", body: "#f3a6b8", belly: "#dc8ea3", accent: "#7a3446" }, width: 120, behavior: "hover", band: [0.3, 0.6], speed: 10 },
  "tripod-fish": { art: { kind: "tripod", body: "#a9a291", belly: "#7d7666", accent: "#38342a" }, width: 160, behavior: "floor", band: [0.72, 0.78], speed: 0 },
  "sea-pig": { art: { kind: "seapig", body: "#f2c1cb", belly: "#e59aab", accent: "#8a4a58" }, width: 140, behavior: "floor", band: [0.8, 0.86], speed: 6 },

  snailfish: { art: { kind: "snailfish", body: "#f1d3dc", belly: "#e4b5c4", accent: "#8a5a68" }, width: 130, behavior: "cruise", band: [0.3, 0.65], speed: 20 },
  amphipod: { art: { kind: "shrimp", body: "#e8dcc4", belly: "#c9b492", accent: "#6d5a3c" }, width: 80, behavior: "dart", band: [0.55, 0.8], speed: 40 },
  xenophyophore: { art: { kind: "xeno", body: "#a89d7e", belly: "#6d6450", accent: "#2e2a20", glow: "#c9ffea" }, width: 130, behavior: "floor", band: [0.8, 0.86], speed: 0 },
};
