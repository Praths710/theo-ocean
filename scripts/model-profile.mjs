// Prints a model's cross-section (usage: node scripts/model-profile.mjs <model> <rx,ry,rz>) along its body (after the game's re-orientation), to place
// the procedural joints (hips, knees, ankles, shoulders). Usage: node scripts/diver-profile.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import * as THREE from "three";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read("client/public/models/" + (process.argv[2] || "diver") + ".glb");
const P = Math.PI;
const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(process.argv[3] || "1.5708,0,-1.5708").split(",").map(Number)));
const pts = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const world = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  const m = rot.clone().multiply(world);
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const mat = prim.getMaterial()?.getName();
    const v = new THREE.Vector3();
    const tmp = [];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, tmp); v.fromArray(tmp).applyMatrix4(m); pts.push([v.x, v.y, v.z, mat]); }
  }
}
const box = new THREE.Box3().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
console.log("size", size.toArray().map((n) => n.toFixed(3)), "ratio y/x", (size.y / size.x).toFixed(3), "z/x", (size.z / size.x).toFixed(3));
const L = size.x;
const bins = 20;
for (let b = 0; b < bins; b++) {
  const s0 = -0.5 + b / bins, s1 = s0 + 1 / bins;
  const sel = pts.filter((p) => { const s = (p[0] - c.x) / L; return s >= s0 && s < s1; });
  if (!sel.length) continue;
  const ys = sel.map((p) => (p[1] - c.y) / L), zs = sel.map((p) => (p[2] - c.z) / L);
  const gapZ = (() => { const s = zs.slice().sort((a, b) => a - b); let g = 0, at = 0; for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > g) { g = s[i] - s[i - 1]; at = (s[i] + s[i - 1]) / 2; } return `${g.toFixed(3)}@${at.toFixed(3)}`; })();
  const mats = [...new Set(sel.map((p) => p[3]))].join(",");
  console.log(`s ${s0.toFixed(2)}..${s1.toFixed(2)} n=${String(sel.length).padStart(5)} y ${Math.min(...ys).toFixed(3)}..${Math.max(...ys).toFixed(3)} z ${Math.min(...zs).toFixed(3)}..${Math.max(...zs).toFixed(3)} zgap ${gapZ} ${mats}`);
}
