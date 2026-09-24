// Shared game content: dive zones (levels) and the species found in each.
// Used by the client to render the scene and by the server to ground the AI companion.

export type Species = {
  id: string;
  name: string;
  scientific: string;
  status: string;
  label: string;
  fact: string;
  details: string;
  habitat: string;
  threats: string;
  action: string;
  /** Pixel-art sprite; species without one fall back to `glyph`. */
  image?: string;
  glyph: string;
  /** Legacy CSS position class from the original preview, or inline coordinates. */
  position?: string;
  pos?: { left?: string; right?: string; top?: string; bottom?: string };
  tone: "pink" | "amber" | "cyan" | "green" | "violet" | "red";
};

export type Zone = {
  id: string;
  level: number;
  name: string;
  depthLabel: string;
  depthMeters: number;
  /** XP needed before the diver may descend into this zone. */
  xpRequired: number;
  /** CSS colour used to tint the water. */
  water: string;
  light: number;
  summary: string;
  species: Species[];
};

export const zones: Zone[] = [
  {
    id: "sunlit",
    level: 1,
    name: "Sunlit Reef",
    depthLabel: "0–200 m",
    depthMeters: 14,
    xpRequired: 0,
    water: "#0b4a6b",
    light: 1,
    summary: "The epipelagic zone. Sunlight powers photosynthesis, so this thin layer holds most of the ocean's familiar life: reefs, kelp, seagrass and the animals that graze them.",
    species: [
      { id: "vaquita", name: "Vaquita", scientific: "Phocoena sinus", status: "Critically endangered", label: "VAQUITA", fact: "Fewer than 10 are thought to remain in the wild. Every protected gillnet-free zone matters.", details: "The vaquita is the smallest living cetacean and lives only in the northern Gulf of California. Its compact range makes local protection especially powerful.", habitat: "Northern Gulf of California", threats: "Illegal gillnets, habitat pressure", action: "Support gillnet-free fishing communities", image: "/manus-storage/tidebound-vaquita_3c8d9d8d.png", glyph: "🐬", position: "species-vaquita", tone: "pink" },
      { id: "hawksbill", name: "Hawksbill turtle", scientific: "Eretmochelys imbricata", status: "Critically endangered", label: "HAWKSBILL TURTLE", fact: "Healthy coral reefs give hawksbills shelter and food — protecting reefs protects the whole chain.", details: "Recognizable by its pointed beak and patterned shell, the hawksbill helps keep reef communities balanced by feeding among coral habitats.", habitat: "Tropical coral reefs", threats: "Illegal shell trade, bycatch, reef loss", action: "Protect nesting beaches and reef habitat", image: "/manus-storage/tidebound-hawksbill_24f2f862.png", glyph: "🐢", position: "species-hawksbill", tone: "amber" },
      { id: "whale", name: "Blue whale", scientific: "Balaenoptera musculus", status: "Endangered", label: "BLUE WHALE", fact: "The largest animal on Earth helps move nutrients through the ocean with every dive and breath.", details: "Blue whales travel across entire ocean basins to feed. Their migrations connect ecosystems and make quiet, collision-safe waters essential.", habitat: "Open ocean, polar feeding zones", threats: "Ship strikes, entanglement, noise", action: "Keep shipping lanes whale-aware", image: "/manus-storage/tidebound-blue-whale_76209c42.png", glyph: "🐋", position: "species-whale", tone: "cyan" },
      { id: "green-turtle", name: "Green sea turtle", scientific: "Chelonia mydas", status: "Endangered", label: "GREEN TURTLE", fact: "Marine protected areas and safer nesting beaches are helping green turtle populations recover.", details: "Green turtles move between coastal feeding grounds and nesting beaches. Seagrass meadows and dark, safe shorelines support each stage.", habitat: "Seagrass meadows, sandy coasts", threats: "Plastic, bycatch, light pollution", action: "Keep nesting beaches dark and clean", image: "/manus-storage/tidebound-green-turtle_7e918cbd.png", glyph: "🐢", position: "species-green", tone: "green" },
    ],
  },
  {
    id: "twilight",
    level: 2,
    name: "Twilight Zone",
    depthLabel: "200–1,000 m",
    depthMeters: 420,
    xpRequired: 150,
    water: "#08304f",
    light: 0.55,
    summary: "The mesopelagic zone. Too dim for photosynthesis, it hosts the largest animal migration on Earth: every night, trillions of animals rise to feed near the surface.",
    species: [
      { id: "lanternfish", name: "Lanternfish", scientific: "Family Myctophidae", status: "Least concern", label: "LANTERNFISH", fact: "Lanternfish may make up more than half of all deep-sea fish biomass.", details: "Covered in light-producing photophores, lanternfish rise hundreds of metres each night to feed, carrying carbon down to the deep when they return.", habitat: "Mesopelagic, worldwide", threats: "Emerging fishmeal fisheries", action: "Keep the twilight zone off-limits to industrial fishing", glyph: "🐟", pos: { left: "10%", top: "26%" }, tone: "cyan" },
      { id: "swordfish", name: "Swordfish", scientific: "Xiphias gladius", status: "Least concern", label: "SWORDFISH", fact: "Swordfish heat their eyes and brain to hunt in cold, dark water.", details: "A special heater organ keeps the swordfish's vision sharp as it dives from the surface into the twilight zone after squid and fish.", habitat: "Tropical and temperate oceans", threats: "Overfishing, longline bycatch", action: "Choose sustainably certified seafood", glyph: "🗡️", pos: { right: "10%", top: "20%" }, tone: "amber" },
      { id: "vampire-squid", name: "Vampire squid", scientific: "Vampyroteuthis infernalis", status: "Least concern", label: "VAMPIRE SQUID", fact: "Despite the name it eats marine snow — drifting particles of dead material.", details: "A living fossil that survives in oxygen-poor water, it turns its webbed arms inside-out into a spiny 'pineapple' posture when threatened.", habitat: "Oxygen minimum zones, 600–900 m", threats: "Ocean deoxygenation", action: "Cut carbon emissions to slow ocean oxygen loss", glyph: "🦑", pos: { left: "52%", top: "12%" }, tone: "red" },
      { id: "siphonophore", name: "Giant siphonophore", scientific: "Praya dubia", status: "Not evaluated", label: "SIPHONOPHORE", fact: "A single colony can stretch 40 m — longer than a blue whale.", details: "Siphonophores are colonies of specialised clones working as one organism, fishing with curtains of stinging tentacles.", habitat: "Mesopelagic, worldwide", threats: "Largely unknown", action: "Support deep-sea exploration and research", glyph: "🪼", pos: { right: "6%", bottom: "18%" }, tone: "violet" },
    ],
  },
  {
    id: "midnight",
    level: 3,
    name: "Midnight Zone",
    depthLabel: "1,000–4,000 m",
    depthMeters: 1800,
    xpRequired: 400,
    water: "#04182d",
    light: 0.25,
    summary: "The bathypelagic zone. No sunlight reaches here; the only light is bioluminescence. Pressure exceeds 100 atmospheres and food is scarce.",
    species: [
      { id: "anglerfish", name: "Humpback anglerfish", scientific: "Melanocetus johnsonii", status: "Least concern", label: "ANGLERFISH", fact: "Its glowing lure is powered by symbiotic bacteria.", details: "Females dangle a bioluminescent lure to attract prey in total darkness. In some anglerfish species, tiny males fuse permanently to females.", habitat: "Bathypelagic, worldwide", threats: "Deep-sea trawling, mining plumes", action: "Back a moratorium on deep-sea mining", glyph: "🎣", pos: { left: "12%", top: "30%" }, tone: "amber" },
      { id: "sperm-whale", name: "Sperm whale", scientific: "Physeter macrocephalus", status: "Vulnerable", label: "SPERM WHALE", fact: "Sperm whales dive past 2,000 m to hunt squid, holding their breath for over an hour.", details: "They have the largest brain of any animal and live in family units with distinct vocal 'dialects' made of clicks.", habitat: "Deep open ocean", threats: "Ship strikes, entanglement, noise", action: "Support quieter shipping and whale-safe speed limits", glyph: "🐳", pos: { left: "46%", top: "8%" }, tone: "cyan" },
      { id: "gulper-eel", name: "Gulper eel", scientific: "Eurypharynx pelecanoides", status: "Least concern", label: "GULPER EEL", fact: "Its hinged mouth is far bigger than its body.", details: "The gulper eel's pouch-like jaw lets it swallow prey far larger than itself — an adaptation to rare meals in the deep.", habitat: "Bathypelagic, worldwide", threats: "Largely unknown", action: "Support deep-sea research", glyph: "🐍", pos: { right: "8%", top: "28%" }, tone: "violet" },
      { id: "giant-squid", name: "Giant squid", scientific: "Architeuthis dux", status: "Least concern", label: "GIANT SQUID", fact: "Its eyes, up to 27 cm across, are the largest in the animal kingdom.", details: "Giant squid were first filmed alive in their habitat only in 2012. They are a key prey of sperm whales.", habitat: "Deep ocean, worldwide", threats: "Largely unknown", action: "Support deep-sea exploration", glyph: "🦑", pos: { right: "6%", bottom: "16%" }, tone: "red" },
    ],
  },
  {
    id: "abyss",
    level: 4,
    name: "Abyssal Plain",
    depthLabel: "4,000–6,000 m",
    depthMeters: 4700,
    xpRequired: 750,
    water: "#020f1f",
    light: 0.12,
    summary: "The abyssopelagic zone covers more than half of Earth's surface. Near-freezing water, crushing pressure, and soft sediment plains dotted with polymetallic nodules.",
    species: [
      { id: "dumbo-octopus", name: "Dumbo octopus", scientific: "Grimpoteuthis spp.", status: "Least concern", label: "DUMBO OCTOPUS", fact: "The deepest-living octopus, recorded near 7,000 m.", details: "Named for ear-like fins it flaps to hover above the seafloor, dumbo octopuses swallow prey whole.", habitat: "Abyssal seafloor, worldwide", threats: "Deep-sea mining, trawling", action: "Back a moratorium on deep-sea mining", glyph: "🐙", pos: { left: "12%", top: "26%" }, tone: "pink" },
      { id: "tripod-fish", name: "Tripod fish", scientific: "Bathypterois grallator", status: "Least concern", label: "TRIPOD FISH", fact: "It stands on three stilt-like fins, facing the current to catch food.", details: "Tripod fish perch motionless on elongated fin rays, waiting for small crustaceans to drift into their mouths.", habitat: "Abyssal plains, 900–4,700 m", threats: "Bottom trawling", action: "Protect seafloor habitats", glyph: "🐟", pos: { right: "10%", top: "22%" }, tone: "cyan" },
      { id: "sea-pig", name: "Sea pig", scientific: "Scotoplanes globosa", status: "Not evaluated", label: "SEA PIG", fact: "Sea pigs are sea cucumbers that walk on water-filled tube feet.", details: "Herds of sea pigs vacuum the sediment for organic matter, recycling nutrients across the abyssal plain.", habitat: "Abyssal plains", threats: "Deep-sea mining", action: "Back a moratorium on deep-sea mining", glyph: "🐷", pos: { right: "8%", bottom: "16%" }, tone: "pink" },
    ],
  },
  {
    id: "hadal",
    level: 5,
    name: "Hadal Trench",
    depthLabel: "6,000–11,000 m",
    depthMeters: 8200,
    xpRequired: 1100,
    water: "#010812",
    light: 0.05,
    summary: "The hadal zone: ocean trenches like the Mariana Trench. Pressure is over 1,000 times that at the surface, yet life persists.",
    species: [
      { id: "snailfish", name: "Mariana snailfish", scientific: "Pseudoliparis swirei", status: "Not evaluated", label: "SNAILFISH", fact: "Snailfish are the deepest fish ever filmed, at about 8,300 m.", details: "Its gelatinous body and flexible skull help it withstand extreme pressure; it is a top predator of the trench.", habitat: "Mariana Trench, 6,000–8,000 m", threats: "Microplastics reaching the trench", action: "Reduce single-use plastics", glyph: "🐟", pos: { left: "14%", top: "28%" }, tone: "violet" },
      { id: "amphipod", name: "Hadal amphipod", scientific: "Hirondellea gigas", status: "Not evaluated", label: "AMPHIPOD", fact: "Amphipods from the deepest trench have been found with plastic in their guts.", details: "These scavenging crustaceans digest sunken wood using special enzymes and swarm quickly to any food fall.", habitat: "Deepest trenches", threats: "Pollutants (PCBs, microplastics)", action: "Support bans on persistent pollutants", glyph: "🦐", pos: { right: "10%", top: "24%" }, tone: "amber" },
      { id: "xenophyophore", name: "Xenophyophore", scientific: "Class Xenophyophorea", status: "Not evaluated", label: "XENOPHYOPHORE", fact: "A single-celled organism that can grow as large as 20 cm.", details: "These giant single cells build fragile shells from sediment and provide habitat for many tiny animals.", habitat: "Abyssal and hadal seafloor", threats: "Seafloor disturbance", action: "Protect the deep seafloor from mining", glyph: "🪸", pos: { right: "8%", bottom: "16%" }, tone: "green" },
    ],
  },
];

export const XP = { discover: 25, quizCorrect: 40, quizAttempt: 5, question: 5 } as const;

export function findZone(id: string | undefined) {
  return zones.find((z) => z.id === id) ?? zones[0];
}

export function findSpecies(id: string | undefined) {
  for (const zone of zones) {
    const s = zone.species.find((sp) => sp.id === id);
    if (s) return { species: s, zone };
  }
  return null;
}

/**
 * Highest zone index the player may enter. A zone opens only after the player has passed the
 * checkpoint of every zone above it (which itself requires scanning all of that zone's species).
 */
export function maxZoneIndex(state: Pick<PlayerState, "passedZones">) {
  let idx = 0;
  while (idx < zones.length - 1 && state.passedZones?.includes(zones[idx].id)) idx++;
  return idx;
}

/** What still stands between the player and the next zone. */
export function checkpointStatus(state: Pick<PlayerState, "discovered" | "passedZones">, zoneId: string) {
  const zone = findZone(zoneId);
  const scanned = zone.species.filter((s) => state.discovered.includes(s.id)).length;
  return { zoneId: zone.id, scanned, total: zone.species.length, allScanned: scanned === zone.species.length, passed: Boolean(state.passedZones?.includes(zone.id)) };
}

/** Checkpoint pass mark: every question right, except zones with 4+ species allow one miss. */
export const checkpointPassMark = (questions: number) => (questions >= 4 ? questions - 1 : questions);

export type LearnerModel = {
  summary: string;
  knowledgeLevel: "beginner" | "intermediate" | "advanced";
  interests: string[];
  strengths: string[];
  gaps: string[];
  ageBand: "child" | "teen" | "adult" | "unknown";
};

export type DiverStyle = {
  name: string;
  suitHue: number; // degrees for hue-rotate
  companionName: string;
  voiceOn: boolean;
};

export type PlayerState = {
  id: string;
  diver: DiverStyle;
  xp: number;
  zoneId: string;
  discovered: string[];
  quiz: { asked: number; correct: number };
  /** Zone ids whose checkpoint quiz has been passed (unlocks the next zone). */
  passedZones?: string[];
  learner: LearnerModel;
  updatedAt: string;
};

export type CheckpointQuestion = { question: string; options: string[]; speciesId: string };
export type Checkpoint = { id: string; zoneId: string; questions: CheckpointQuestion[]; passMark: number };
export type CheckpointResult = {
  passed: boolean;
  score: number;
  total: number;
  passMark: number;
  results: { correct: boolean; correctIndex: number; explanation: string }[];
  unlocked?: string;
};

export type Quiz = {
  id: string;
  question: string;
  options: string[];
  speciesId?: string;
  zoneId: string;
};
