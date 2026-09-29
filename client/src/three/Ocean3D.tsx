import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import ModelActor, { type GearLook } from "./ModelActor";
import { MODEL_CONFIG, SPECIES_MODEL, type ModelId } from "./modelConfig";

// The 3D layer of a dive. It is purely visual: gameplay (positions, input, scanning) stays in
// Dive.tsx in "world pixels"; here 1 world unit = 100 px and the camera is placed so the z = 0
// plane lines up exactly with the screen. Scenery sits at other depths for real parallax.

export type Swimmer3D = { id: string; x: number; y: number; vx: number; vy: number; dir: 1 | -1; w: number };
type Ref<T> = { current: T };

const FOV = 38;
const U = 100; // px per world unit

type ZoneLook = { fog: string; sky: string; ground: string; hemi: number; sun: number; sunColor: string; sand: string; caustic: number; lamp: number; density: number };
const LOOKS: ZoneLook[] = [
  { fog: "#1e6d8f", sky: "#a9e4f5", ground: "#0b3a52", hemi: 0.85, sun: 1.25, sunColor: "#fff3d6", sand: "#7d7358", caustic: 0.55, lamp: 0, density: 0.035 },
  { fog: "#0b3350", sky: "#7fb8e0", ground: "#061c2e", hemi: 0.5, sun: 0.55, sunColor: "#a8d4ff", sand: "#5e5c52", caustic: 0.25, lamp: 0.6, density: 0.05 },
  { fog: "#03121f", sky: "#335a78", ground: "#020a12", hemi: 0.14, sun: 0.1, sunColor: "#6f9cc4", sand: "#34332f", caustic: 0, lamp: 1, density: 0.07 },
  { fog: "#020a13", sky: "#23384a", ground: "#010508", hemi: 0.08, sun: 0.04, sunColor: "#5d7a94", sand: "#2a2926", caustic: 0, lamp: 1, density: 0.08 },
  { fog: "#01060c", sky: "#1b2b38", ground: "#000305", hemi: 0.06, sun: 0.02, sunColor: "#4c6275", sand: "#1d1c1a", caustic: 0, lamp: 1, density: 0.09 },
];

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Camera locked to the gameplay plane: follows the side-scrolling camera in Dive.tsx. */
function Rig({ view, camera: cam }: { view: { w: number; h: number }; camera: Ref<{ x: number }> }) {
  const { camera } = useThree();
  const dist = (view.h / U / 2) / Math.tan(((FOV / 2) * Math.PI) / 180);
  useFrame(() => {
    const x = (cam.current.x + view.w / 2) / U;
    const y = -view.h / 2 / U;
    camera.position.set(x, y, dist);
    camera.lookAt(x, y, 0);
  });
  return null;
}

function Lights({ look, body }: { look: ZoneLook; body: Ref<{ x: number; y: number; facing: 1 | -1 }> }) {
  const spot = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const halo = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const b = body.current;
    const x = b.x / U, y = -b.y / U;
    spot.current?.position.set(x + b.facing * 0.9, y + 0.1, 0.4);
    target.position.set(x + b.facing * 8, y - 0.8, 0);
    target.updateMatrixWorld();
    halo.current?.position.set(x + b.facing * 0.6, y + 0.2, 1.2);
  });
  return (
    <>
      <hemisphereLight args={[look.sky, look.ground, look.hemi]} />
      <directionalLight position={[4, 12, 6]} intensity={look.sun} color={look.sunColor} />
      <ambientLight intensity={0.08 + look.hemi * 0.1} />
      <spotLight ref={spot} target={target} intensity={look.lamp * 60} distance={16} angle={0.42} penumbra={0.55} decay={1.6} color="#dff4ff" />
      <pointLight ref={halo} intensity={look.lamp * 2.5} distance={4} decay={2} color="#cfeaff" />
      <primitive object={target} />
    </>
  );
}

/** Rolling sand/sediment seafloor with animated caustic light in the sunlit zones. */
function Seafloor({ worldW, floorY, look }: { worldW: number; floorY: number; look: ZoneLook }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCaustic: { value: look.caustic } }), [look.caustic]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(worldW + 40, 44, Math.min(600, Math.round(worldW * 4)), 70);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = Math.sin(x * 0.35) * 0.25 + Math.sin(x * 1.1 + z * 0.7) * 0.12 + Math.sin(z * 0.45 + x * 0.2) * 0.35 + (z < -8 ? (-8 - z) * 0.18 : 0);
      p.setY(i, h);
    }
    g.computeVertexNormals();
    return g;
  }, [worldW]);
  useEffect(() => {
    const m = mat.current;
    if (!m) return;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldP;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
varying vec3 vWorldP; uniform float uTime; uniform float uCaustic;
float cst(vec2 p, float t){ vec2 i = p; float c = 0.0;
  for (int n = 0; n < 3; n++) { float tt = t * (1.0 - 0.6/float(n+1)); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x)); c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.01), p.y / (cos(i.y + tt) / 0.01))); }
  c = 1.2 - pow(c / 3.0, 1.35); return clamp(pow(abs(c), 7.0), 0.0, 1.5); }`)
        .replace("#include <color_fragment>", `#include <color_fragment>
// sand ripples + patchy colour so the floor isn't a flat colour
float rip = sin(vWorldP.x * 3.1 + sin(vWorldP.z * 1.7) * 1.6) * 0.5 + 0.5;
float sandPatch = sin(vWorldP.x * 0.37 + vWorldP.z * 0.53) * sin(vWorldP.z * 0.29 - vWorldP.x * 0.21) * 0.5 + 0.5;
diffuseColor.rgb *= 0.78 + rip * 0.14 + sandPatch * 0.16;`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.55, 0.9, 1.0) * cst(vWorldP.xz * 1.6, uTime * 0.6) * 0.35 * uCaustic;`);
    };
    m.needsUpdate = true;
  }, [uniforms]);
  useFrame((_, dt) => { uniforms.uTime.value += dt; });
  return (
    <mesh geometry={geo} position={[worldW / 2, floorY, -10]}>
      <meshStandardMaterial ref={mat} color={look.sand} roughness={0.95} metalness={0} />
    </mesh>
  );
}

/** Scattered rock outcrops (all zones) and coral heads (sunlit reef). */
function Scenery({ zoneIndex, worldW, floorY }: { zoneIndex: number; worldW: number; floorY: number }) {
  const rocks = useGLTF(MODEL_CONFIG.rocks.file, false, true);
  const coral = useGLTF(MODEL_CONFIG["coral-reef"].file, false, true);
  const placements = useMemo(() => {
    const r = rng(1234 + zoneIndex * 97);
    const out: { kind: "rock" | "coral"; x: number; z: number; s: number; ry: number }[] = [];
    for (let x = -3; x < worldW + 3; x += 2.2 + r() * 3) {
      const coralHere = zoneIndex === 0 && r() < 0.6;
      out.push({ kind: coralHere ? "coral" : "rock", x, z: coralHere ? -2 - r() * 9 : -6 - r() * 12, s: coralHere ? 0.8 + r() * 1.3 : 0.45 + r() * 0.9, ry: r() * Math.PI * 2 });
      if (zoneIndex === 0 && r() < 0.35) out.push({ kind: "coral", x: x + 0.8, z: -1.5 - r() * 3, s: 0.5 + r() * 0.7, ry: r() * Math.PI * 2 });
    }
    return out;
  }, [zoneIndex, worldW]);
  // Normalise each source model once.
  const norm = useMemo(() => {
    const f = (scene: THREE.Object3D, len: number) => {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const s = len / Math.max(size.x, size.z, 1e-6);
      return { s, lift: -box.min.y * s };
    };
    return { rock: f(rocks.scene, 2.2), coral: f(coral.scene, 1.7) };
  }, [rocks.scene, coral.scene]);
  const tint = useMemo(() => ["#ffffff", "#8fa7b8", "#5b6670", "#4a4f55", "#3d4146"][zoneIndex], [zoneIndex]);
  useEffect(() => {
    rocks.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.color) { m.userData.base ??= m.color.clone(); m.color.copy(m.userData.base).multiply(new THREE.Color(tint)); } });
  }, [rocks.scene, tint]);
  return (
    <>
      {placements.map((p, i) => {
        const n = p.kind === "rock" ? norm.rock : norm.coral;
        return <Clone key={i} object={p.kind === "rock" ? rocks.scene : coral.scene} position={[p.x, floorY + n.lift * p.s - (p.kind === "rock" ? 0.55 * p.s : 0.12), p.z]} scale={n.s * p.s} rotation={[0, p.ry, 0]} />;
      })}
    </>
  );
}

/** Swaying kelp forest (sunlit) / sparse stalks (twilight). */
function Kelp({ worldW, floorY, zoneIndex }: { worldW: number; floorY: number; zoneIndex: number }) {
  const count = zoneIndex === 0 ? 120 : zoneIndex === 1 ? 18 : 0;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const geo = useMemo(() => { const g = new THREE.PlaneGeometry(0.14, 1, 1, 24); g.translate(0, 0.5, 0); return g; }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", side: THREE.DoubleSide, roughness: 0.55, transparent: true, opacity: 0.92 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z;
float h = uv.y;
transformed.x += sin(uTime * 0.9 + ph + h * 2.5) * 0.35 * h * h;
transformed.z += cos(uTime * 0.7 + ph) * 0.18 * h * h;
transformed.x *= (1.0 - h * 0.55) * (1.0 + sin(h * 26.0 + ph) * 0.45); // tapering, ruffled blade`);
    };
    return m;
  }, [uniforms, zoneIndex]);
  useEffect(() => {
    if (!mesh.current) return;
    const r = rng(77 + zoneIndex);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const h = 2.5 + r() * 5;
      m4.compose(new THREE.Vector3(r() * (worldW + 4) - 2, floorY - 0.1, -1 - r() * 12), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI, 0)), new THREE.Vector3(1 + r() * 0.6, h, 1));
      mesh.current.setMatrixAt(i, m4);
      mesh.current.setColorAt(i, new THREE.Color().setHSL(0.24 + r() * 0.08, 0.45 + r() * 0.2, (zoneIndex === 0 ? 0.2 : 0.1) + r() * 0.1));
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [count, worldW, floorY, zoneIndex]);
  useFrame((_, dt) => { uniforms.uTime.value += dt; });
  if (!count) return null;
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />;
}

/**
 * One animal, following its gameplay swimmer. Turns are a real U-turn: the body swings through
 * depth (away from the camera) instead of spinning on the spot, and it pitches with its climb.
 */
function Animal({ speciesId, swimmers, onReady }: { speciesId: string; swimmers: Ref<Swimmer3D[]>; onReady: (id: string) => void }) {
  const model = SPECIES_MODEL[speciesId] as ModelId;
  const group = useRef<THREE.Group>(null);
  const yaw = useRef<number | null>(null);
  const pitch = useRef(0);
  const tempo = useRef(1);
  const s = swimmers.current.find((w) => w.id === speciesId);
  const length = (s?.w ?? MODEL_CONFIG[model].length * U) / U;
  useFrame((_, dt) => {
    const w = swimmers.current.find((v) => v.id === speciesId);
    if (!w || !group.current) return;
    const target = w.dir === 1 ? 0 : Math.PI;
    if (yaw.current === null) yaw.current = target;
    yaw.current += (target - yaw.current) * (1 - Math.exp(-2.2 * dt));
    const speed = Math.hypot(w.vx, w.vy);
    const p = THREE.MathUtils.clamp(-w.vy / (Math.abs(w.vx) + 80), -0.35, 0.35);
    pitch.current += (p - pitch.current) * (1 - Math.exp(-3 * dt));
    tempo.current = THREE.MathUtils.clamp(0.45 + speed / 90, 0.45, 1.8);
    const turning = Math.sin(yaw.current); // 0 when side-on, ±1 mid-turn
    group.current.position.set(w.x / U, -w.y / U, -Math.abs(turning) * length * 0.45);
    group.current.rotation.set(0, yaw.current, pitch.current); // pitch is in the body's own frame, so no flip when facing left
  });
  return (
    <group ref={group}>
      <ModelActor id={model} length={length} tempo={tempo} onReady={() => onReady(speciesId)} />
    </group>
  );
}

function Diver3D({ body, onReady, look, length }: { body: Ref<{ x: number; y: number; vx: number; vy: number; facing: 1 | -1 }>; onReady: () => void; look?: GearLook; length: number }) {
  const group = useRef<THREE.Group>(null);
  const yaw = useRef<number | null>(null);
  const pitch = useRef(0);
  const tempo = useRef(1);
  const effort = useRef(0);
  const t = useRef(0);
  useFrame((_, dt) => {
    const b = body.current;
    if (!group.current) return;
    t.current += dt;
    const target = b.facing === 1 ? 0 : Math.PI;
    if (yaw.current === null) yaw.current = target;
    yaw.current += (target - yaw.current) * (1 - Math.exp(-4 * dt));
    const speed = Math.hypot(b.vx, b.vy);
    const e = Math.min(1, speed / 260);
    effort.current += (e - effort.current) * (1 - Math.exp(-3 * dt));
    tempo.current = 0.45 + effort.current * 1.1;
    // Head leads the climb/dive; level out when drifting.
    const p = THREE.MathUtils.clamp(-b.vy / (Math.abs(b.vx) + 160), -0.5, 0.5);
    pitch.current += (p - pitch.current) * (1 - Math.exp(-4 * dt));
    const turning = Math.sin(yaw.current);
    const bob = Math.sin(t.current * 1.3) * 0.03 * (1 - effort.current); // floating at rest
    group.current.position.set(b.x / U, -b.y / U + bob, 0.45 - Math.abs(turning) * 0.6); // just in front of the animals' plane
    // YXZ: turn first, then roll/pitch about the diver's own body axes (so leaning into a turn
    // never tips the head up or down).
    group.current.rotation.set(turning * 0.25, yaw.current, pitch.current + Math.sin(t.current * 0.9) * 0.03, "YXZ");
  });
  return (
    <group ref={group}>
      <ModelActor id="diver" length={length} tempo={tempo} effort={effort} onReady={onReady} look={look} />
    </group>
  );
}

export default function Ocean3D({ zoneIndex, view, worldW, camera, body, swimmers, speciesIds, onModelReady, gear }: {
  zoneIndex: number;
  gear?: GearLook;
  view: { w: number; h: number };
  worldW: number;
  camera: Ref<{ x: number }>;
  body: Ref<{ x: number; y: number; vx: number; vy: number; facing: 1 | -1 }>;
  swimmers: Ref<Swimmer3D[]>;
  speciesIds: string[];
  /** Called with "diver" or a species id once its 3D model is on screen (so the 2D art can hide). */
  onModelReady: (id: string) => void;
}) {
  const look = LOOKS[zoneIndex] ?? LOOKS[0];
  const floorY = -(view.h * 0.93) / U;
  const W = worldW / U;
  const dist = (view.h / U / 2) / Math.tan(((FOV / 2) * Math.PI) / 180);
  return (
    <Canvas
      className="ocean-3d"
      style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}
      dpr={[1, Math.min(1.75, window.devicePixelRatio || 1)]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [view.w / 2 / U, -view.h / 2 / U, dist] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.outputColorSpace = THREE.SRGBColorSpace; }}
    >
      <fog attach="fog" args={[look.fog, dist * 0.75, dist * (2.4 - zoneIndex * 0.22)]} />
      <Rig view={view} camera={camera} />
      <Lights look={look} body={body} />
      <Seafloor worldW={W} floorY={floorY} look={look} />
      <Kelp worldW={W} floorY={floorY} zoneIndex={zoneIndex} />
      <Suspense fallback={null}><Scenery zoneIndex={zoneIndex} worldW={W} floorY={floorY} /></Suspense>
      {speciesIds.filter((id) => SPECIES_MODEL[id]).map((id) => (
        <Suspense key={id} fallback={null}><Animal speciesId={id} swimmers={swimmers} onReady={onModelReady} /></Suspense>
      ))}
      <Suspense fallback={null}><Diver3D body={body} onReady={() => onModelReady("diver")} look={gear} length={Math.min(2.3, (view.w * 0.42) / U)} /></Suspense>
    </Canvas>
  );
}
