import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Animals with no free 3D model, built from code with realistic proportions and materials.
// Each builder returns a group facing +X (head right, back up) at an arbitrary size; ModelActor
// normalises the length, centres it and adds the swim motion like any downloaded model.

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** A body of revolution along +X: `radius(t)` for t = 0 (tail) .. 1 (snout). */
function bodyAlongX(length: number, radius: (t: number) => number, segs = 40, radial = 24, squashZ = 1) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector2(Math.max(radius(t), 0.0005), t * length - length / 2));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  g.rotateZ(-Math.PI / 2); // lathe axis Y -> X, tail at -X, snout at +X
  g.scale(1, 1, squashZ);
  g.computeVertexNormals();
  return g;
}

/** Back-to-belly colour gradient (darker back, paler belly) as vertex colours. */
function shade(g: THREE.BufferGeometry, back: string, belly: string, spots?: { color: string; seed: number; density: number }) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(p);
  const cb = new THREE.Color(back), cl = new THREE.Color(belly), sc = spots ? new THREE.Color(spots.color) : null;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - box.min.y) / Math.max(1e-6, box.max.y - box.min.y);
    c.copy(cl).lerp(cb, THREE.MathUtils.smoothstep(t, 0.3, 0.8));
    if (sc && spots) {
      const n = Math.sin(p.getX(i) * 37 + spots.seed) * Math.sin(p.getZ(i) * 41 + spots.seed * 2) * Math.sin(p.getY(i) * 29);
      if (n > 1 - spots.density) c.lerp(sc, 0.6);
    }
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

/** A tube along a curve whose radius tapers with `radius(t)`. */
function taperedTube(points: THREE.Vector3[], radius: (t: number) => number, tubular = 24, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const ring = radial + 1;
  for (let i = 0; i < p.count; i++) {
    const seg = Math.floor(i / ring);
    const t = seg / tubular;
    const centre = curve.getPointAt(t);
    const v = new THREE.Vector3().fromBufferAttribute(p, i).sub(centre).multiplyScalar(radius(t)).add(centre);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** A thin fin from an outline (in the XY plane), slightly translucent. */
function fin(outline: [number, number][], at: THREE.Vector3, rotY = 0) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape, 8);
  g.rotateY(rotY);
  g.translate(at.x, at.y, at.z);
  return g;
}

function eye(r: number, at: THREE.Vector3, glow = false) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshPhysicalMaterial({ color: glow ? "#2a2f33" : "#0b0d10", roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }));
  m.position.copy(at);
  return m;
}

const skin = (opts: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35, side: THREE.DoubleSide, ...opts });

/** Tripod fish (Bathypterois grallator): slender grey body perched on three long stilt fin rays. */
export function buildTripodFish() {
  const g = new THREE.Group();
  const L = 1;
  const body = bodyAlongX(L, (t) => 0.095 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.02)), 0.75) * (0.55 + 0.45 * t), 48, 24, 0.82);
  shade(body, "#6f6a5e", "#c9c2ae");
  g.add(new THREE.Mesh(body, skin({ roughness: 0.45 })));
  g.add(eye(0.016, new THREE.Vector3(0.43, 0.022, 0.045)), eye(0.016, new THREE.Vector3(0.43, 0.022, -0.045)));
  const finMat = new THREE.MeshPhysicalMaterial({ color: "#8d8676", roughness: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  // Tail fin, dorsal fin.
  g.add(new THREE.Mesh(fin([[0, 0], [-0.13, 0.08], [-0.11, 0], [-0.13, -0.07], [0, 0]], new THREE.Vector3(-0.47, 0, 0)), finMat));
  g.add(new THREE.Mesh(fin([[0, 0], [0.04, 0.09], [0.12, 0.02], [0.12, 0]], new THREE.Vector3(0.0, 0.055, 0)), finMat));
  const rayMat = new THREE.MeshPhysicalMaterial({ color: "#d8d1bd", roughness: 0.4, clearcoat: 0.6 });
  // Two pelvic stilts and one long tail ray, splayed like a tripod.
  const stilts: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(0.12, -0.06, 0.03), new THREE.Vector3(0.22, -0.95, 0.16)],
    [new THREE.Vector3(0.12, -0.06, -0.03), new THREE.Vector3(0.22, -0.95, -0.16)],
    [new THREE.Vector3(-0.44, -0.03, 0), new THREE.Vector3(-0.62, -0.95, 0)],
  ];
  for (const [a, b] of stilts) {
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.05, 0));
    g.add(new THREE.Mesh(taperedTube([a, mid, b], (t) => 0.011 * (1 - t * 0.6), 24, 6), rayMat));
  }
  // Pectoral fin rays held up and forward like antennae, feeling the current.
  for (const side of [1, -1]) {
    const a = new THREE.Vector3(0.3, 0.02, 0.05 * side);
    g.add(new THREE.Mesh(taperedTube([a, new THREE.Vector3(0.36, 0.25, 0.12 * side), new THREE.Vector3(0.52, 0.42, 0.2 * side), new THREE.Vector3(0.74, 0.46, 0.24 * side)], (t) => 0.006 * (1 - t * 0.7), 28, 5), rayMat));
  }
  return g;
}

/** Mariana snailfish (Pseudoliparis swirei): pale, gelatinous, tadpole-like with a long fin skirt. */
export function buildSnailfish() {
  const g = new THREE.Group();
  const L = 1;
  // Tadpole profile: rounded snout, big head, long tapering tail.
  const body = bodyAlongX(L, (t) => 0.14 * Math.pow(Math.sin(Math.PI * Math.min(0.999, t * 0.97 + 0.015)), 0.45) * (0.1 + 0.9 * THREE.MathUtils.smoothstep(t, 0.05, 0.72)), 56, 28, 0.9);
  shade(body, "#d48499", "#f0c4d0");
  g.add(new THREE.Mesh(body, skin({ transparent: true, opacity: 0.86, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: new THREE.Color("#ffd9e4"), emissive: new THREE.Color("#5a2a38"), emissiveIntensity: 0.25 })));
  // Organs faintly visible through the jelly-like skin.
  const organ = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: "#c76f86", roughness: 0.6, transparent: true, opacity: 0.55 }));
  organ.position.set(0.12, -0.02, 0); organ.scale.set(1.6, 0.9, 0.9);
  g.add(organ);
  g.add(eye(0.014, new THREE.Vector3(0.43, 0.04, 0.07)), eye(0.014, new THREE.Vector3(0.43, 0.04, -0.07)));
  // A continuous, translucent fin skirt along the back and belly of the tail.
  const skirt = new THREE.MeshPhysicalMaterial({ color: "#f3d3dc", roughness: 0.3, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const top: [number, number][] = [], bot: [number, number][] = [];
  for (let i = 0; i <= 20; i++) { const x = -0.5 + i * 0.035; top.push([x, 0.02 + 0.05 * Math.sin((i / 20) * Math.PI) + 0.01]); bot.push([x, -0.02 - 0.055 * Math.sin((i / 20) * Math.PI) - 0.01]); }
  g.add(new THREE.Mesh(fin([[-0.5, 0], ...top, [0.2, 0.02], [0.2, 0]], new THREE.Vector3(0, 0, 0)), skirt));
  g.add(new THREE.Mesh(fin([[-0.5, 0], ...bot, [0.2, -0.02], [0.2, 0]], new THREE.Vector3(0, 0, 0)), skirt));
  // Pectoral fins, broad and lobed.
  for (const side of [1, -1]) {
    const pf = new THREE.Mesh(fin([[0, 0], [-0.05, 0.08], [-0.13, 0.07], [-0.14, -0.02], [-0.06, -0.06], [0, -0.02]], new THREE.Vector3(0.28, -0.03, 0.1 * side), side * 0.5), skirt);
    g.add(pf);
  }
  return g;
}

/** Xenophyophore: a giant single cell, a lumpy, pitted mound of cemented sediment on the seafloor. */
export function buildXenophyophore() {
  const r = rng(42);
  const lumps = Array.from({ length: 9 }, () => ({ d: new THREE.Vector3(r() - 0.5, r() * 0.7, r() - 0.5).normalize(), k: 0.12 + r() * 0.18, w: 3 + r() * 4 }));
  const pits = Array.from({ length: 46 }, () => ({ d: new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.1, r() - 0.5).normalize(), size: 0.05 + r() * 0.09 }));
  // Shared vertices so the surface shades smoothly (the raw icosphere is faceted).
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 7).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const base = new THREE.Color("#9c8c6b"), dark = new THREE.Color("#2f2a20"), rim = new THREE.Color("#c4b591");
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const dir = v.clone().normalize();
    let rad = 1;
    for (const l of lumps) rad += l.k * Math.pow(Math.max(0, dir.dot(l.d)), l.w);
    rad += 0.03 * Math.sin(dir.x * 23) * Math.sin(dir.y * 19) * Math.sin(dir.z * 21) + 0.012 * Math.sin(dir.x * 71 + dir.z * 53); // grainy sediment
    let pit = 0;
    for (const q of pits) { const a = dir.angleTo(q.d); if (a < q.size) pit = Math.max(pit, 1 - a / q.size); }
    rad -= Math.pow(pit, 0.6) * 0.16; // the openings in its fragile test
    v.copy(dir).multiplyScalar(rad);
    v.y = v.y < -0.15 ? -0.15 + (v.y + 0.15) * 0.15 : v.y * 0.72; // sits flat on the floor
    p.setXYZ(i, v.x * 1.15, v.y, v.z);
    c.copy(base).lerp(rim, Math.max(0, 0.5 - pit) * 0.4).lerp(dark, Math.min(1, pit * 1.4));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })));
  return group;
}

/** Sea pig (Scotoplanes): a plump, translucent pink sea cucumber walking on tube feet. */
export function buildSeaPig() {
  const g = new THREE.Group();
  const body = bodyAlongX(1, (t) => 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.96 + 0.02)), 0.55), 40, 28, 0.85);
  // Flatten the belly so it sits on its feet.
  const p = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.06) p.setY(i, -0.06 + (p.getY(i) + 0.06) * 0.35);
  body.computeVertexNormals();
  shade(body, "#d77d92", "#f2bcc8");
  const pink = skin({ transparent: true, opacity: 0.9, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.8, sheenColor: new THREE.Color("#ffd0da"), emissive: new THREE.Color("#4a1f28"), emissiveIntensity: 0.2 });
  g.add(new THREE.Mesh(body, pink));
  const limb = new THREE.MeshPhysicalMaterial({ color: "#eaa2b1", roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.92 });
  // Six pairs of tube feet underneath.
  for (let i = 0; i < 6; i++) {
    const x = -0.32 + i * 0.13;
    for (const side of [1, -1]) {
      const a = new THREE.Vector3(x, -0.07, 0.11 * side);
      g.add(new THREE.Mesh(taperedTube([a, new THREE.Vector3(x + 0.01, -0.13, 0.15 * side), new THREE.Vector3(x + 0.02, -0.19, 0.17 * side)], (t) => 0.03 * (1 - t * 0.45), 10, 8), limb));
    }
  }
  // Dorsal papillae ("antennae") near the front, and feeding tentacles around the mouth.
  for (const [x, len] of [[0.3, 0.32], [0.22, 0.24]] as const) {
    for (const side of [1, -1]) {
      const a = new THREE.Vector3(x, 0.13, 0.06 * side);
      g.add(new THREE.Mesh(taperedTube([a, new THREE.Vector3(x + 0.04, 0.13 + len * 0.55, 0.09 * side), new THREE.Vector3(x + 0.12, 0.13 + len, 0.12 * side)], (t) => 0.022 * (1 - t * 0.75), 16, 8), limb));
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new THREE.Vector3(0.48, -0.02 + Math.sin(a) * 0.05, Math.cos(a) * 0.05);
    g.add(new THREE.Mesh(taperedTube([s, s.clone().add(new THREE.Vector3(0.05, -0.04 + Math.sin(a) * 0.02, Math.cos(a) * 0.03))], (t) => 0.012 * (1 - t * 0.5), 6, 6), limb));
  }
  return g;
}
