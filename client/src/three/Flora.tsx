import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Underwater plants, built procedurally and drawn instanced (one draw call per kind):
//  - giant kelp: a stipe with golden-olive fronds spiralling up it, each on a little gas bladder,
//    swaying from the holdfast with the swell, blades fluttering, sunlight glowing through them;
//  - seagrass meadows: clumps of thin ribbons on the sand.
// Heights are 1 in the template and scaled per plant; `sandHeight` keeps every base on the floor.

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Height of the seafloor surface (matches the Seafloor mesh) at world x/z, relative to floorY. */
export function sandHeight(x: number, z: number, worldW: number) {
  const lx = x - worldW / 2, lz = z + 10;
  return Math.sin(lx * 0.35) * 0.25 + Math.sin(lx * 1.1 + lz * 0.7) * 0.12 + Math.sin(lz * 0.45 + lx * 0.2) * 0.35 + (lz < -8 ? (-8 - lz) * 0.18 : 0);
}

type Builder = { pos: number[]; nor: number[]; col: number[]; h: number[]; leaf: number[]; idx: number[] };
const newBuilder = (): Builder => ({ pos: [], nor: [], col: [], h: [], leaf: [], idx: [] });

function addVertex(b: Builder, p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, h: number, leaf: number) {
  b.pos.push(p.x, p.y, p.z); b.nor.push(n.x, n.y, n.z); b.col.push(c.r, c.g, c.b); b.h.push(h); b.leaf.push(leaf);
  return b.pos.length / 3 - 1;
}

function toGeometry(b: Builder) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute("aH", new THREE.Float32BufferAttribute(b.h, 1));
  g.setAttribute("aLeaf", new THREE.Float32BufferAttribute(b.leaf, 1));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
}

/** A strip following `center(t)` with half-width `half(t)` along `side(t)`, t = 0..1. */
function addStrip(b: Builder, steps: number, center: (t: number) => THREE.Vector3, side: (t: number) => THREE.Vector3, half: (t: number) => number, color: (t: number) => THREE.Color, h: (t: number) => number, leaf: (t: number) => number) {
  let prev: [number, number] | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = center(t), s = side(t), w = half(t);
    const tangent = center(Math.min(1, t + 0.01)).sub(center(Math.max(0, t - 0.01))).normalize();
    const n = new THREE.Vector3().crossVectors(s, tangent).normalize();
    const a = addVertex(b, c.clone().addScaledVector(s, -w), n, color(t), h(t), leaf(t));
    const d = addVertex(b, c.clone().addScaledVector(s, w), n, color(t), h(t), leaf(t));
    if (prev) b.idx.push(prev[0], prev[1], a, prev[1], d, a);
    prev = [a, d];
  }
}

function buildKelp(seed: number) {
  const r = rng(seed);
  const b = newBuilder();
  const stipeX = (y: number) => Math.sin(y * 5.5 + seed) * 0.02;
  const stipeCol = new THREE.Color("#3b3212");
  // Stipe: two crossed ribbons so it reads as round from any angle.
  for (const rot of [0, Math.PI / 2]) {
    const side = new THREE.Vector3(Math.cos(rot), 0, Math.sin(rot));
    addStrip(b, 36, (t) => new THREE.Vector3(stipeX(t), t, 0), () => side, (t) => 0.0065 * (1 - t * 0.5), () => stipeCol, (t) => t, () => 0);
  }
  // Fronds spiral up the stipe on the golden angle.
  const blades = 32;
  for (let i = 0; i < blades; i++) {
    const h0 = 0.05 + (i / blades) * 0.93 + (r() - 0.5) * 0.02;
    const ang = i * 2.39996 + r() * 0.4;
    const out = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const perp = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    const len = 0.12 + r() * 0.09;
    const wid = 0.016 + r() * 0.008;
    const rise = 0.35 + r() * 0.35;
    const base = new THREE.Vector3(stipeX(h0), h0, 0).addScaledVector(out, 0.012);
    const tone = 0.85 + r() * 0.3;
    const cA = new THREE.Color("#5a4814").multiplyScalar(tone), cB = new THREE.Color("#a28c3a").multiplyScalar(tone);
    const id = i + 1;
    addStrip(b, 9,
      (t) => base.clone().addScaledVector(out, len * t).add(new THREE.Vector3(0, len * (rise * t - 0.35 * t * t), 0)),
      (t) => perp.clone().applyAxisAngle(out, t * 0.9 + r() * 0.0), // gentle twist along the blade
      (t) => wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08 + 0.04)), 0.65) * (1 + 0.22 * Math.sin(t * 26 + i)),
      (t) => cA.clone().lerp(cB, Math.min(1, t * 1.3)),
      (t) => h0 + t * len * 0.3,
      (t) => id + t * 0.98);
    // Pneumatocyst (the gas float at the base of each blade).
    const bc = new THREE.Color("#8b7a2c").multiplyScalar(tone);
    const bl = new THREE.Vector3().copy(base).addScaledVector(out, -0.004);
    const rad = 0.0075;
    const ring: number[][] = [];
    for (let yi = 0; yi <= 4; yi++) {
      const phi = (yi / 4) * Math.PI, row: number[] = [];
      for (let xi = 0; xi <= 6; xi++) {
        const th = (xi / 6) * Math.PI * 2;
        const n = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        row.push(addVertex(b, bl.clone().addScaledVector(n, rad).add(new THREE.Vector3(0, n.y * rad * 0.4, 0)), n, bc, h0, 0));
      }
      ring.push(row);
    }
    for (let yi = 0; yi < 4; yi++) for (let xi = 0; xi < 6; xi++) {
      const a = ring[yi][xi], c = ring[yi][xi + 1], d = ring[yi + 1][xi], e = ring[yi + 1][xi + 1];
      b.idx.push(a, d, c, c, d, e);
    }
  }
  return toGeometry(b);
}

function buildGrassBlade() {
  const b = newBuilder();
  const side = new THREE.Vector3(1, 0, 0);
  const col = new THREE.Color("#ffffff");
  addStrip(b, 6, (t) => new THREE.Vector3(0, t, Math.sin(t * 2.2) * 0.08 * t), () => side, (t) => 0.018 * (1 - t * 0.85), () => col, (t) => t, (t) => t);
  return toGeometry(b);
}

/** Sway + translucency shared by both plant kinds. */
function plantMaterial(u: { uTime: { value: number }; uGlow: { value: number } }, sway: { amp: number; speed: number; flutter: number }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aH; attribute float aLeaf; uniform float uTime; varying float vH;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.3;
  float bend = pow(aH, 1.6);
  // The swell: a slow push and pull with a faster ripple on top, strongest at the tips.
  transformed.x += (sin(uTime * ${(0.55 * sway.speed).toFixed(3)} + ph) * ${sway.amp.toFixed(3)} + sin(uTime * ${(1.25 * sway.speed).toFixed(3)} + ph * 1.7) * ${(sway.amp * 0.28).toFixed(3)}) * bend;
  transformed.z += cos(uTime * ${(0.45 * sway.speed).toFixed(3)} + ph * 0.8) * ${(sway.amp * 0.55).toFixed(3)} * bend;
  // Blades flutter along their length.
  float along = fract(aLeaf);
  float isBlade = step(0.5, aLeaf);
  transformed.y += sin(uTime * 2.1 + aLeaf * 3.1) * ${sway.flutter.toFixed(4)} * along * isBlade;
  transformed.x += sin(uTime * 1.7 + aLeaf * 2.3) * ${(sway.flutter * 1.3).toFixed(4)} * along * isBlade;
  vH = aH;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlow; varying float vH;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
// Sunlight glowing through thin tissue, brighter towards the sunlit tips.
totalEmissiveRadiance += diffuseColor.rgb * uGlow * (0.3 + 0.7 * vH);`);
  };
  return m;
}

function scatter(mesh: THREE.InstancedMesh | null, count: number, place: (i: number, m: THREE.Matrix4, c: THREE.Color) => void) {
  if (!mesh) return;
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < count; i++) { place(i, m4, c); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, c); }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

const KELP = [
  { count: 64, glow: 0.42, tint: "#ffffff" }, // sunlit only: kelp needs sunlight (DeepLife covers the deep)
];

export function KelpForest({ zoneIndex, worldW, floorY, lite }: { zoneIndex: number; worldW: number; floorY: number; lite: boolean }) {
  const cfg = KELP[zoneIndex];
  const count = cfg ? Math.round(cfg.count * (lite ? 0.55 : 1)) : 0;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const u = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: cfg?.glow ?? 0 } }), [cfg]);
  const geo = useMemo(() => buildKelp(7), []);
  const mat = useMemo(() => plantMaterial(u, { amp: 0.07, speed: 1, flutter: 0.004 }), [u]);
  useEffect(() => {
    const r = rng(311 + zoneIndex);
    const top = -floorY + 0.6; // reach up past the top of the screen (the kelp canopy)
    scatter(mesh.current, count, (_, m, c) => {
      const x = r() * (worldW + 6) - 3, z = -1.4 - Math.pow(r(), 0.8) * 14;
      const h = top * (0.55 + r() * 0.7);
      m.compose(new THREE.Vector3(x, floorY + sandHeight(x, z, worldW) - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI * 2, 0)), new THREE.Vector3(h, h, h));
      c.set(cfg.tint).multiplyScalar(0.85 + r() * 0.3);
    });
  }, [count, worldW, floorY, zoneIndex, cfg]);
  useFrame((_, dt) => { u.uTime.value += dt; });
  if (!count) return null;
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />;
}

const GRASS = [
  { count: 2600, glow: 0.18, hue: [0.2, 0.28], light: [0.2, 0.36] }, // sunlit only, like the kelp
];

export function Seagrass({ zoneIndex, worldW, floorY, lite }: { zoneIndex: number; worldW: number; floorY: number; lite: boolean }) {
  const cfg = GRASS[zoneIndex];
  const count = cfg ? Math.round(cfg.count * (lite ? 0.45 : 1)) : 0;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const u = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: cfg?.glow ?? 0 } }), [cfg]);
  const geo = useMemo(() => buildGrassBlade(), []);
  const mat = useMemo(() => plantMaterial(u, { amp: 0.22, speed: 1.9, flutter: 0 }), [u]);
  useEffect(() => {
    const r = rng(733 + zoneIndex);
    // Meadows: clumps of blades around scattered centres, thinning out between them.
    const centres = Array.from({ length: Math.max(6, Math.round(worldW / 2.2)) }, () => ({ x: r() * worldW, z: 1.5 - r() * 11, rad: 0.8 + r() * 2.2 }));
    scatter(mesh.current, count, (_, m, c) => {
      const ce = centres[Math.floor(r() * centres.length)];
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * ce.rad;
      const x = ce.x + Math.cos(a) * d, z = ce.z + Math.sin(a) * d * 0.6;
      const h = (0.35 + r() * 0.65) * (1 - (d / ce.rad) * 0.45);
      m.compose(new THREE.Vector3(x, floorY + sandHeight(x, z, worldW) - 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * Math.PI * 2, (r() - 0.5) * 0.3)), new THREE.Vector3(1 + r() * 0.6, h, 1));
      c.setHSL(cfg.hue[0] + r() * (cfg.hue[1] - cfg.hue[0]), 0.42 + r() * 0.2, cfg.light[0] + r() * (cfg.light[1] - cfg.light[0]));
    });
  }, [count, worldW, floorY, zoneIndex, cfg]);
  useFrame((_, dt) => { u.uTime.value += dt; });
  if (!count) return null;
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />;
}

