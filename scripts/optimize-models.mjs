// Shrinks downloaded GLB models for the web and writes client/public/models/manifest.json.
// Usage: node scripts/optimize-models.mjs            (all models in models-raw/)
//        node scripts/optimize-models.mjs whale diver (just these)
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, simplify, textureCompress, resample, meshopt, getBounds, flatten, join } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const RAW = path.join(ROOT, "models-raw");
const OUT = path.join(ROOT, "client", "public", "models");
const MAX_TRIS = { diver: 40000, "sea-pig": 30000, "giant-squid": 30000, amphipod: 30000, rocks: 25000, "gulper-eel": 25000, default: 20000 };
const SIMPLIFY_ERROR = { "sea-pig": 0.2, default: 0.01 };
const TEX = { diver: 1024, whale: 1024, "green-turtle": 1024, hawksbill: 1024, rocks: 1024, "coral-reef": 1024, default: 512 };

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

/** Vertex-clustering simplification for 3D scans whose triangles aren't connected (normal simplify can't reduce them). */
const sloppy = (ratio) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const count = pos.getCount();
      let idx = prim.getIndices()?.getArray();
      if (!idx) idx = Uint32Array.from({ length: count }, (_, i) => i);
      const positions = new Float32Array(count * 3);
      const el = [];
      for (let i = 0; i < count; i++) { pos.getElement(i, el); positions.set(el, i * 3); }
      const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
      const [out] = MeshoptSimplifier.simplifySloppy(Uint32Array.from(idx), positions, 3, null, target, 0.02);
      const acc = doc.createAccessor().setType("SCALAR").setArray(out).setBuffer(pos.getBuffer());
      prim.setIndices(acc);
    }
  }
};

const countTris = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0), 0);

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, "manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const only = process.argv.slice(2);

for (const file of fs.readdirSync(RAW).filter((f) => f.endsWith(".glb"))) {
  const id = file.replace(/\.glb$/, "");
  if (only.length && !only.includes(id)) continue;
  const t0 = Date.now();
  const doc = await io.read(path.join(RAW, file));
  const before = countTris(doc);
  const maxTris = MAX_TRIS[id] ?? MAX_TRIS.default;
  const ratio = Math.min(1, maxTris / Math.max(1, before));

  await doc.transform(
    dedup(),
    prune(),
    ...(id === "sea-pig" ? [flatten(), join({ keepNamed: false })] : []),
    weld(),
    ...(id === "sea-pig" && ratio < 0.98 ? [sloppy(ratio)] : []),
    ...(id !== "sea-pig" && ratio < 0.98 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: SIMPLIFY_ERROR[id] ?? SIMPLIFY_ERROR.default, lockBorder: false })] : []),
    resample(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [TEX[id] ?? TEX.default, TEX[id] ?? TEX.default], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(4));
  const center = b.max.map((v, i) => +((v + b.min[i]) / 2).toFixed(4));
  const clips = doc.getRoot().listAnimations().map((a) => a.getName() || "clip");
  const skinned = doc.getRoot().listSkins().length > 0;

  const outFile = path.join(OUT, `${id}.glb`);
  await io.write(outFile, doc);
  const bytes = fs.statSync(outFile).size;
  const after = countTris(doc);
  manifest[id] = { ...(manifest[id] ?? {}), file: `/models/${id}.glb`, bytes, tris: Math.round(after), size, center, clips, skinned };
  const rawMb = (fs.statSync(path.join(RAW, file)).size / 1048576).toFixed(1);
  console.log(`${id.padEnd(16)} ${rawMb.padStart(6)} MB -> ${(bytes / 1048576).toFixed(2).padStart(5)} MB | tris ${Math.round(before)} -> ${Math.round(after)} | clips: ${clips.length ? clips.join(", ") : "none"}${skinned ? " (skinned)" : ""} | size ${size.join(" x ")} | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nmanifest: ${Object.keys(manifest).length} models`);
