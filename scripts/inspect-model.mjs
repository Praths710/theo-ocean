// Lists the meshes in a raw model with vertex counts and bounds. Usage: node scripts/inspect-model.mjs sea-pig
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const id = process.argv[2];
const file = path.resolve("models-raw", `${id}.glb`);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(file);
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const verts = mesh.listPrimitives().reduce((n, p) => n + p.getAttribute("POSITION").getCount(), 0);
  const b = getBounds(node);
  const size = b.max.map((v, i) => (v - b.min[i]).toFixed(3));
  const mats = mesh.listPrimitives().map((p) => p.getMaterial()?.getName() ?? "-").join(",");
  console.log(`${node.getName().padEnd(40)} verts ${String(verts).padStart(7)} size ${size.join(" x ")} mat ${mats}`);
}
