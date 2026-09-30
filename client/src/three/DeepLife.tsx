import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sandHeight } from "./Flora";

// Life on the deep seafloor, one set per zone (kelp and seagrass need sunlight, so they stay shallow):
//  - twilight: gorgonian sea fans and sea whips (deep-water corals);
//  - midnight: glass sponges, stalked crinoids (feather stars), blinking bioluminescence;
//  - abyssal and hadal: glass sponges and fields of manganese nodules, bioluminescence.
// All procedural and instanced; each kind is one draw call.

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

type Geo = { pos: number[]; nor: number[]; col: number[]; h: number[]; idx: number[] };
const newGeo = (): Geo => ({ pos: [], nor: [], col: [], h: [], idx: [] });

function strip(g: Geo, steps: number, center: (t: number) => THREE.Vector3, side: THREE.Vector3, half: (t: number) => number, color: (t: number) => THREE.Color) {
  let prev: [number, number] | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, c = center(t), w = half(t), col = color(t);
    const tan = center(Math.min(1, t + 0.01)).sub(center(Math.max(0, t - 0.01))).normalize();
    const n = new THREE.Vector3().crossVectors(side, tan).normalize();
    const base = g.pos.length / 3;
    for (const sgn of [-1, 1]) {
      const p = c.clone().addScaledVector(side, w * sgn);
      g.pos.push(p.x, p.y, p.z); g.nor.push(n.x, n.y, n.z); g.col.push(col.r, col.g, col.b); g.h.push(p.y);
    }
    if (prev) g.idx.push(prev[0], prev[1], base, prev[1], base + 1, base);
    prev = [base, base + 1];
  }
}

function toBuffer(g: Geo) {
  const b = new THREE.BufferGeometry();
  b.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3));
  b.setAttribute("normal", new THREE.Float32BufferAttribute(g.nor, 3));
  b.setAttribute("color", new THREE.Float32BufferAttribute(g.col, 3));
  b.setAttribute("aH", new THREE.Float32BufferAttribute(g.h, 1));
  b.setIndex(g.idx);
  b.computeBoundingSphere();
  return b;
}

/** A gorgonian: a flat, finely branching fan (height 1), facing the current. */
function buildSeaFan(seed: number) {
  const r = rng(seed), g = newGeo();
  const grow = (start: THREE.Vector3, ang: number, len: number, width: number, depth: number) => {
    const bend = (r() - 0.5) * 0.5;
    const side = new THREE.Vector3(Math.cos(ang), -Math.sin(ang), 0); // width lies in the fan's plane, facing the viewer
    const end = (t: number) => {
      const a = ang + bend * t;
      return start.clone().add(new THREE.Vector3(Math.sin(a) * len * t, Math.cos(a) * len * t, 0));
    };
    strip(g, 4, end, side, (t) => width * (1 - t * 0.35), (t) => new THREE.Color("#ffffff").multiplyScalar(0.72 + 0.28 * Math.min(1, start.y + t * len)));
    if (depth <= 0) return;
    const tip = end(1);
    const spread = 0.32 + r() * 0.22;
    grow(tip, ang - spread, len * (0.7 + r() * 0.12), width * 0.72, depth - 1);
    grow(tip, ang + spread, len * (0.7 + r() * 0.12), width * 0.72, depth - 1);
  };
  grow(new THREE.Vector3(0, 0, 0), 0, 0.2, 0.024, 6);
  return toBuffer(g);
}

/** Sea whip: a single long, gently curving rod. */
function buildSeaWhip() {
  const g = newGeo();
  strip(g, 14, (t) => new THREE.Vector3(Math.sin(t * 2.4) * 0.12 * t, t, 0), new THREE.Vector3(1, 0, 0), (t) => 0.012 * (1 - t * 0.6), () => new THREE.Color("#ffffff"));
  strip(g, 14, (t) => new THREE.Vector3(Math.sin(t * 2.4) * 0.12 * t, t, 0), new THREE.Vector3(0, 0, 1), (t) => 0.012 * (1 - t * 0.6), () => new THREE.Color("#ffffff"));
  return toBuffer(g);
}

/** Stalked crinoid (sea lily): a thin stalk crowned by ten feathery arms curling outwards. */
function buildCrinoid(seed: number) {
  const r = rng(seed), g = newGeo();
  for (const rot of [0, Math.PI / 2]) {
    const side = new THREE.Vector3(Math.cos(rot), 0, Math.sin(rot));
    strip(g, 16, (t) => new THREE.Vector3(Math.sin(t * 3) * 0.02, t * 0.72, 0), side, () => 0.006, () => new THREE.Color("#c8b89a"));
  }
  const crown = new THREE.Vector3(Math.sin(3) * 0.02, 0.72, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.2;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const perp = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const len = 0.28 + r() * 0.06;
    strip(g, 10, (t) => crown.clone().addScaledVector(out, len * Math.sin(t * 1.9) * 0.9).add(new THREE.Vector3(0, len * (0.55 * t - 0.25 * t * t * t), 0)), perp,
      (t) => 0.02 * (1 - t * 0.7) * (1 + 0.35 * Math.sin(t * 40)), (t) => new THREE.Color("#ffffff").multiplyScalar(0.8 + t * 0.2));
  }
  return toBuffer(g);
}

/** Venus's flower basket: a glass-sponge vase with a lattice skeleton. */
function buildGlassSponge() {
  const pts = [[0.03, 0], [0.09, 0.08], [0.15, 0.3], [0.18, 0.6], [0.19, 0.85], [0.17, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 22);
  const h = new Float32Array(g.attributes.position.count);
  for (let i = 0; i < h.length; i++) h[i] = g.attributes.position.getY(i);
  g.setAttribute("aH", new THREE.BufferAttribute(h, 1));
  return g;
}

function swayMaterial(u: { uTime: { value: number } }, opts: { amp: number; speed: number; glow: THREE.Color; glowK: number; lattice?: boolean }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: !opts.lattice, side: THREE.DoubleSide, roughness: 0.7, metalness: 0, transparent: Boolean(opts.lattice), opacity: opts.lattice ? 0.85 : 1 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uGlow: { value: opts.glow }, uGlowK: { value: opts.glowK } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aH; uniform float uTime; varying float vH; varying vec2 vLat;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  float ph = instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 1.1;
  float bend = aH * aH;
  transformed.x += sin(uTime * ${(0.5 * opts.speed).toFixed(3)} + ph) * ${opts.amp.toFixed(3)} * bend;
  transformed.z += cos(uTime * ${(0.4 * opts.speed).toFixed(3)} + ph) * ${(opts.amp * 0.6).toFixed(3)} * bend;
  vH = aH;
  vLat = uv;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uGlow; uniform float uGlowK; varying float vH; varying vec2 vLat;")
      .replace("#include <alphatest_fragment>", opts.lattice ? `#include <alphatest_fragment>
{
  // Silica lattice: a square grid crossed by diagonals, holes in between.
  vec2 q = vec2(vLat.x * 26.0, vLat.y * 16.0);
  float grid = min(abs(fract(q.x) - 0.5), abs(fract(q.y) - 0.5));
  float diag = abs(fract((q.x + q.y) * 0.5) - 0.5);
  if (min(grid, diag) > 0.16) discard;
}` : "#include <alphatest_fragment>")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += uGlow * uGlowK * (0.4 + 0.6 * vH);`);
  };
  return m;
}

function placeOnFloor(mesh: THREE.InstancedMesh | null, count: number, seed: number, worldW: number, floorY: number, size: () => number, color: (r: () => number, c: THREE.Color) => void, zRange: [number, number] = [-1, -13]) {
  if (!mesh) return;
  const r = rng(seed), m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = r() * (worldW + 6) - 3, z = zRange[0] + (zRange[1] - zRange[0]) * Math.pow(r(), 0.8);
    const s = size();
    // Fans face the viewer (broadside to the current), with some variety.
    m4.compose(new THREE.Vector3(x, floorY + sandHeight(x, z, worldW) - 0.04, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 1.2, (r() - 0.5) * 0.2)), new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(i, m4);
    color(r, c);
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

type Kind = "fan" | "whip" | "crinoid" | "sponge" | "nodule";
const PLAN: Record<number, Partial<Record<Kind, number>>> = {
  1: { fan: 56, whip: 70, sponge: 8 },
  2: { fan: 16, crinoid: 22, sponge: 14 },
  3: { crinoid: 10, sponge: 18, nodule: 900 },
  4: { sponge: 10, nodule: 1200 },
};
const FAN_COLORS = [["#e2562b", "#f0a33a", "#c23658", "#f3c552"], ["#e6c2cf", "#f2e3e8", "#d98fa8", "#ffffff"]];

function Instanced({ kind, zoneIndex, worldW, floorY, lite }: { kind: Kind; zoneIndex: number; worldW: number; floorY: number; lite: boolean }) {
  const count = Math.round((PLAN[zoneIndex]?.[kind] ?? 0) * (lite ? 0.5 : 1));
  const mesh = useRef<THREE.InstancedMesh>(null);
  const u = useMemo(() => ({ uTime: { value: 0 } }), []);
  const deep = zoneIndex >= 2;
  const { geo, mat } = useMemo(() => {
    switch (kind) {
      case "fan": return { geo: buildSeaFan(17), mat: swayMaterial(u, { amp: 0.03, speed: 0.8, glow: new THREE.Color("#ff9a6a"), glowK: deep ? 0.3 : 0.38 }) };
      case "whip": return { geo: buildSeaWhip(), mat: swayMaterial(u, { amp: 0.08, speed: 1, glow: new THREE.Color("#ffc46a"), glowK: 0.3 }) };
      case "crinoid": return { geo: buildCrinoid(29), mat: swayMaterial(u, { amp: 0.05, speed: 0.7, glow: new THREE.Color("#fff0c0"), glowK: 0.18 }) };
      case "sponge": return { geo: buildGlassSponge(), mat: swayMaterial(u, { amp: 0.004, speed: 0.5, glow: new THREE.Color("#cfe9ff"), glowK: deep ? 0.6 : 0.2, lattice: true }) };
      case "nodule": {
        const m = new THREE.MeshStandardMaterial({ color: "#4a3c2c", roughness: 0.85, metalness: 0.2 });
        return { geo: new THREE.IcosahedronGeometry(1, 1), mat: m };
      }
    }
  }, [kind, u, deep]);
  useEffect(() => {
    const fanSet = FAN_COLORS[deep ? 1 : 0];
    switch (kind) {
      case "fan": return placeOnFloor(mesh.current, count, 401 + zoneIndex, worldW, floorY, () => 1.3 + Math.random() * 1.9, (r, c) => c.set(fanSet[Math.floor(r() * fanSet.length)]));
      case "whip": return placeOnFloor(mesh.current, count, 503 + zoneIndex, worldW, floorY, () => 0.8 + Math.random() * 1.6, (r, c) => c.set(["#f2b33a", "#e8742c", "#f5d27a"][Math.floor(r() * 3)]));
      case "crinoid": return placeOnFloor(mesh.current, count, 607 + zoneIndex, worldW, floorY, () => 0.6 + Math.random() * 0.9, (r, c) => c.set(["#f0e2b8", "#e9b872", "#f7f2e6"][Math.floor(r() * 3)]));
      case "sponge": return placeOnFloor(mesh.current, count, 709 + zoneIndex, worldW, floorY, () => 0.6 + Math.random() * 1.1, (_, c) => c.set("#f1ead6"));
      case "nodule": return placeOnFloor(mesh.current, count, 811 + zoneIndex, worldW, floorY, () => 0.03 + Math.pow(Math.random(), 2) * 0.1, (r, c) => c.set("#3a3026").multiplyScalar(0.7 + r() * 0.5), [2, -12]);
    }
  }, [kind, count, worldW, floorY, zoneIndex, deep]);
  useFrame((_, dt) => { u.uTime.value += dt; });
  if (!count) return null;
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />;
}

/** Blinking bioluminescent sparks: blue-green flashes that pulse and fade. */
function Bioluminescence({ zoneIndex, worldW, floorY, lite }: { zoneIndex: number; worldW: number; floorY: number; lite: boolean }) {
  const count = zoneIndex >= 2 ? Math.round((lite ? 220 : 480) * Math.min(2, worldW / 40 + 0.5)) : 0;
  const { geo, mat } = useMemo(() => {
    const r = rng(97 + zoneIndex);
    const pos = new Float32Array(count * 3), seed = new Float32Array(count), hue = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r() * (worldW + 8) - 4;
      pos[i * 3 + 1] = floorY + Math.pow(r(), 1.6) * (-floorY);
      pos[i * 3 + 2] = 2.5 - r() * 16;
      seed[i] = r(); hue[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aHue", new THREE.BufferAttribute(hue, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed; attribute float aHue; uniform float uTime; varying float vA; varying float vHue;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.3;
          p.y += sin(uTime * 0.15 + aSeed * 17.0) * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          // Each spark flashes briefly every few seconds.
          float cycle = fract(uTime * (0.08 + aSeed * 0.12) + aSeed * 7.0);
          float flash = smoothstep(0.0, 0.05, cycle) * (1.0 - smoothstep(0.05, 0.3, cycle));
          vA = (0.08 + flash) * smoothstep(30.0, 6.0, d);
          vHue = aHue;
          gl_PointSize = (4.0 + flash * 10.0) * (10.0 / d);
        }`,
      fragmentShader: `
        varying float vA; varying float vHue;
        void main() {
          float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
          vec3 col = mix(vec3(0.2, 0.9, 1.0), vec3(0.3, 1.0, 0.6), vHue);
          gl_FragColor = vec4(col, vA * smoothstep(0.5, 0.0, r));
        }`,
    });
    return { geo: g, mat: m };
  }, [count, worldW, floorY, zoneIndex]);
  useFrame((_, dt) => { mat.uniforms.uTime.value += dt; });
  if (!count) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />;
}

export default function DeepLife(props: { zoneIndex: number; worldW: number; floorY: number; lite: boolean }) {
  if (props.zoneIndex < 1) return null;
  return (
    <>
      {(["fan", "whip", "crinoid", "sponge", "nodule"] as Kind[]).map((k) => <Instanced key={k} kind={k} {...props} />)}
      <Bioluminescence {...props} />
    </>
  );
}
