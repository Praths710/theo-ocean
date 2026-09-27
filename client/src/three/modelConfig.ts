// Per-model settings for the 3D ocean. `rot` re-orients each artist's export so the animal faces
// +X (head to the right) with its back up (+Y); `length` is the body length in world units
// (1 unit = 100 screen px at the gameplay plane). Credits are required by the CC BY licence.

export type ModelId =
  | "diver" | "vaquita" | "hawksbill" | "green-turtle" | "whale" | "lanternfish" | "swordfish" | "vampire-squid"
  | "siphonophore" | "anglerfish" | "sperm-whale" | "gulper-eel" | "giant-squid" | "dumbo-octopus" | "sea-pig"
  | "amphipod" | "coral-reef" | "rocks";

export type ModelConfig = {
  file: string;
  rot: [number, number, number];
  /** Which dimension length refers to: body length (default) or the largest side, for upright animals. */
  fit?: "x" | "max";
  length: number;
  clip?: RegExp;
  clipSpeed?: number;
  /** Procedural motion for models without animation clips. */
  swim?: { mode: "wave" | "kick"; amp: number; freq: number; speed: number };
  tint?: string;
  emissive?: string;
  emissiveIntensity?: number;
  wet?: boolean;
  credit: { title: string; author: string; url: string; license?: string };
};

const P = Math.PI;
const sf = (uid: string) => `https://sketchfab.com/3d-models/${uid}`;

export const MODEL_CONFIG: Record<ModelId, ModelConfig> = {
  diver: { file: "/models/diver.glb", rot: [P / 2, 0, -P / 2], length: 2.3, swim: { mode: "kick", amp: 0.05, freq: 0, speed: 7 }, credit: { title: "Scuba Diver", author: "turelljc", url: sf("3cffae9b572d4506b3025e29d6ff068c"), license: "CC Attribution" } },
  vaquita: { file: "/models/vaquita.glb", rot: [0, P / 2, 0], length: 2.0, clip: /^swim$/i, wet: true, credit: { title: "Vaquita (Phocoena sinus)", author: "Major", url: sf("01c460470303460587b8a5310db2e5ee"), license: "CC Attribution" } },
  hawksbill: { file: "/models/hawksbill.glb", rot: [0, P / 2, 0], length: 1.9, credit: { title: "Hawksbill Turtle", author: "Bindestrek", url: sf("bd6c9327fd52469782f055a182659bd2"), license: "CC Attribution" } },
  "green-turtle": { file: "/models/green-turtle.glb", rot: [0, -P / 2, 0], length: 1.8, credit: { title: "Sea Turtle", author: "Eloi", url: sf("23dcb315dea44f5082b020b04710bd31"), license: "CC Attribution" } },
  whale: { file: "/models/whale.glb", rot: [0, P / 2, 0], length: 5.6, clipSpeed: 0.6, credit: { title: "Blue Whale - Textured", author: "Bohdan Lvov", url: sf("d24d19021c724c3a9134eebcb76b0e0f"), license: "CC Attribution" } },
  lanternfish: { file: "/models/lanternfish.glb", rot: [0, P / 2, 0], length: 0.9, emissive: "#1a6f80", emissiveIntensity: 0.4, credit: { title: "lanternFishCache_01", author: "jasonstrougo", url: sf("2f4cebdd22a049cdb41e76028b2e6d5c"), license: "CC Attribution" } },
  swordfish: { file: "/models/swordfish.glb", rot: [0, P, 0], length: 2.8, swim: { mode: "wave", amp: 0.06, freq: 6, speed: 7 }, wet: true, credit: { title: "Sword Fish", author: "Carlos.Maciel", url: sf("9f076eb541a44a96b65e53a4062db506"), license: "CC Attribution" } },
  "vampire-squid": { file: "/models/vampire-squid.glb", rot: [-P / 2, 0, -P / 2], length: 1.8, credit: { title: "Vampire Squid", author: "Razan Negm", url: sf("4a19c53d3f8b43af884299caab48fe9d"), license: "CC Attribution" } },
  siphonophore: { file: "/models/siphonophore.glb", rot: [0, 0, 0], length: 0.9, emissive: "#6a5cff", emissiveIntensity: 0.5, credit: { title: "Marrus/Deep-Sea Jellyfish (Siphonophora)", author: "n-", url: sf("4a9d9b8553b14ccda32033cbb6c2c9b7"), license: "CC Attribution" } },
  anglerfish: { file: "/models/anglerfish.glb", rot: [0, P, 0], length: 1.6, credit: { title: "Anglerfish", author: "Abby_Holzworth1", url: sf("5e2f4b2d2e1a4613a008b6caaf40d50c"), license: "CC Attribution" } },
  "sperm-whale": { file: "/models/sperm-whale.glb", rot: [0, P / 2, 0], length: 5.2, clipSpeed: 0.6, credit: { title: "Animated Sperm Whale", author: "Anees Animates", url: sf("3076676b30294c119ec2065c3bf3dc47"), license: "CC Attribution" } },
  "gulper-eel": { file: "/models/gulper-eel.glb", rot: [0, P / 2, 0], length: 2.4, swim: { mode: "wave", amp: 0.1, freq: 9, speed: 3 }, credit: { title: "Gulper Eel (Eurypharynx pelecanoides)", author: "SpaceGolby", url: sf("fbae0106acab48f4869141df9d8c37da"), license: "CC Attribution" } },
  "giant-squid": { file: "/models/giant-squid.glb", rot: [-P / 2, 0, -P / 2], length: 3.2, clip: /flap/i, credit: { title: "Giant Squid Creature", author: "Ethan", url: sf("b8b1738f406749aa8ffd53f7ac84132c"), license: "CC Attribution" } },
  "dumbo-octopus": { file: "/models/dumbo-octopus.glb", rot: [0, -P / 2, 0], fit: "max", length: 1.3, credit: { title: "Opisthoteuthidae / Dumbo Octopus", author: "APO", url: sf("b798bba56507441fb9abf959128f5f26"), license: "CC Attribution" } },
  "sea-pig": { file: "/models/sea-pig.glb", rot: [0, P / 2, 0], length: 1.4, credit: { title: "Sea Pig - Echinoderm", author: "stephenandrewmalcolm", url: sf("ab025ddddef94444988b01ece97ee941"), license: "CC Attribution" } },
  amphipod: { file: "/models/amphipod.glb", rot: [0, P, 0], length: 0.9, emissive: "#9fd8ff", emissiveIntensity: 0.25, credit: { title: "Lab 3DR - Hyperiid amphipod (Cystisoma sp.)", author: "MBARI", url: sf("b893a839c6064e3aa4a7c05b8a4b7c37"), license: "CC Attribution" } },
  "coral-reef": { file: "/models/coral-reef.glb", rot: [0, 0, 0], length: 3.0, credit: { title: "Coral Reef 3 L", author: "stefanorivera", url: sf("cb1f7998ca5f452cb8a29ed4162d7a32"), license: "CC Attribution" } },
  rocks: { file: "/models/rocks.glb", rot: [0, 0, 0], length: 6.0, credit: { title: "cave rocks", author: "DJMaesen", url: sf("ea11069c86ce410d8c8e7423d87344de"), license: "CC Attribution" } },
};

/** Species id -> model id (species without a model keep their illustrated art). */
export const SPECIES_MODEL: Partial<Record<string, ModelId>> = {
  vaquita: "vaquita", hawksbill: "hawksbill", "green-turtle": "green-turtle", whale: "whale",
  lanternfish: "lanternfish", swordfish: "swordfish", "vampire-squid": "vampire-squid", siphonophore: "siphonophore",
  anglerfish: "anglerfish", "sperm-whale": "sperm-whale", "gulper-eel": "gulper-eel", "giant-squid": "giant-squid",
  "dumbo-octopus": "dumbo-octopus", amphipod: "amphipod", // sea-pig: the downloaded file is a museum diorama, not a single animal
};
