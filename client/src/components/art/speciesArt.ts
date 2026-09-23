import type { Art } from "./Creature";

export type Behavior = "cruise" | "dart" | "hover" | "floor" | "drift";

/** Visual + movement settings per species. `band` = vertical range as fraction of screen height. */
export const speciesArt: Record<string, { art: Art; width: number; behavior: Behavior; band: [number, number]; speed: number }> = {
  vaquita: { art: { kind: "porpoise", body: "#8a9aa6", belly: "#d7dfe4", accent: "#1c2630" }, width: 190, behavior: "cruise", band: [0.2, 0.55], speed: 55 },
  hawksbill: { art: { kind: "turtle", body: "#9a6a2e", belly: "#d9a867", accent: "#2d1a08" }, width: 170, behavior: "cruise", band: [0.35, 0.7], speed: 32 },
  whale: { art: { kind: "whale", body: "#4d6f8f", belly: "#a9c1d3", accent: "#132433" }, width: 520, behavior: "cruise", band: [0.08, 0.3], speed: 22 },
  "green-turtle": { art: { kind: "turtle", body: "#4f6b3a", belly: "#b9c58a", accent: "#1d2a12" }, width: 160, behavior: "cruise", band: [0.5, 0.8], speed: 28 },

  lanternfish: { art: { kind: "lanternfish", body: "#3c4f66", belly: "#9fb6c8", glow: "#8ff6ff" }, width: 90, behavior: "dart", band: [0.2, 0.6], speed: 80 },
  swordfish: { art: { kind: "swordfish", body: "#33475f", belly: "#9fb3c4" }, width: 260, behavior: "dart", band: [0.15, 0.45], speed: 110 },
  "vampire-squid": { art: { kind: "vampire", body: "#7a1f2a", belly: "#4a0f18", accent: "#2a0710" }, width: 170, behavior: "hover", band: [0.45, 0.75], speed: 14 },
  siphonophore: { art: { kind: "siphonophore", body: "#9ff", glow: "#b19bff" }, width: 70, behavior: "drift", band: [0.1, 0.35], speed: 8 },

  anglerfish: { art: { kind: "angler", body: "#2a2622", belly: "#141210", accent: "#5a4a3a", glow: "#bff6ff" }, width: 150, behavior: "hover", band: [0.4, 0.75], speed: 12 },
  "sperm-whale": { art: { kind: "sperm", body: "#4a4b52", belly: "#6c6d75", accent: "#15161a" }, width: 500, behavior: "cruise", band: [0.06, 0.25], speed: 26 },
  "gulper-eel": { art: { kind: "eel", body: "#1e1a24", belly: "#0d0b10", glow: "#ff6fb1" }, width: 230, behavior: "drift", band: [0.3, 0.6], speed: 18 },
  "giant-squid": { art: { kind: "squid", body: "#a3403a", belly: "#6b2521" }, width: 300, behavior: "cruise", band: [0.55, 0.8], speed: 20 },

  "dumbo-octopus": { art: { kind: "octopus", body: "#f0a3b4", belly: "#d67b90" }, width: 110, behavior: "hover", band: [0.3, 0.6], speed: 10 },
  "tripod-fish": { art: { kind: "tripod", body: "#b8b0a0", belly: "#8c8474" }, width: 150, behavior: "floor", band: [0.72, 0.78], speed: 0 },
  "sea-pig": { art: { kind: "seapig", body: "#f4c3cb", belly: "#e39aa8" }, width: 130, behavior: "floor", band: [0.8, 0.86], speed: 6 },

  snailfish: { art: { kind: "snailfish", body: "#f3d5dd", belly: "#e2b6c3" }, width: 120, behavior: "cruise", band: [0.3, 0.65], speed: 20 },
  amphipod: { art: { kind: "shrimp", body: "#e7d9c2", belly: "#c9b494", accent: "#6d5b40" }, width: 70, behavior: "dart", band: [0.55, 0.8], speed: 40 },
  xenophyophore: { art: { kind: "xeno", body: "#b9ae8e", belly: "#7d7358", glow: "#c9ffea" }, width: 120, behavior: "floor", band: [0.8, 0.86], speed: 0 },
};
