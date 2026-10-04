import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ModelActor from "./ModelActor";
import { KelpForest, Seagrass } from "./Flora";
import DeepLife from "./DeepLife";
import { MarineSnow, SunShafts, SurfaceFromBelow } from "./Water";
import { LOOKS, Lights, Scenery, Seafloor } from "./Ocean3D";
import type { ModelId } from "./modelConfig";
import UnderwaterEnv from "./UnderwaterEnv";
import { isIntegratedGpu } from "./gpu";

// The same 3D ocean as the dive, as a living background for the home screen and the login page:
// the zone's seafloor, plants, light and particles, seen by a camera that drifts slowly sideways,
// with a few animals cruising past.

const FOV = 38;
const VIEW_H = 7.6;          // world units from the surface to just below the floor line
const WORLD_W = 40;

function DriftingCamera() {
  const { camera } = useThree();
  const dist = VIEW_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const x = WORLD_W / 2 + Math.sin(t * 0.05) * 5;
    camera.position.set(x, -VIEW_H / 2 + Math.sin(t * 0.13) * 0.15, dist);
    camera.lookAt(x, -VIEW_H / 2 - 0.2, 0);
  });
  return null;
}

/** An animal cruising across the scene and back, turning at each end. */
function Cruiser({ id, y, z, length, speed, phase }: { id: ModelId; y: number; z: number; length: number; speed: number; phase: number }) {
  const group = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    // A long ping-pong path across the world; smooth turn where it reverses.
    const span = WORLD_W + 8;
    const u = ((clock.elapsedTime * speed) / span + phase) % 2;
    const goingRight = u < 1;
    const x = -4 + (goingRight ? u : 2 - u) * span;
    yaw.current += ((goingRight ? 0 : Math.PI) - yaw.current) * (1 - Math.exp(-1.5 * dt));
    group.current.position.set(x, y + Math.sin(clock.elapsedTime * 0.4 + phase * 9) * 0.25, z - Math.abs(Math.sin(yaw.current)) * length * 0.5);
    group.current.rotation.set(0, yaw.current, 0);
  });
  const tempo = useMemo(() => ({ current: 0.8 }), []);
  return (
    <group ref={group}>
      <ModelActor id={id} length={length} tempo={tempo} />
    </group>
  );
}

export default function Backdrop3D({ zoneIndex, className, cruisers = [] }: { zoneIndex: number; className?: string; cruisers?: { id: ModelId; y: number; z: number; length: number; speed: number; phase: number }[] }) {
  const look = LOOKS[zoneIndex] ?? LOOKS[0];
  const floorY = -VIEW_H * 0.93;
  const lite = true; // decorative background: fewer plants/particles, 1x resolution
  const dist = VIEW_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
  const lamp = useMemo(() => ({ current: { x: (WORLD_W / 2) * 100, y: (VIEW_H / 2) * 100, facing: 1 as const } }), []);
  return (
    <Canvas className={className} dpr={1} gl={{ alpha: true, antialias: !isIntegratedGpu(), powerPreference: "high-performance" }}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [WORLD_W / 2, -VIEW_H / 2, dist] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
      <fog attach="fog" args={[look.fog, dist * 0.75, dist * (2.4 - zoneIndex * 0.22)]} />
      <DriftingCamera />
      <Lights look={look} body={lamp} />
      {!isIntegratedGpu() && <UnderwaterEnv intensity={[0.5, 0.28, 0.14, 0.1, 0.08][zoneIndex] ?? 0.1} />}
      <Seafloor worldW={WORLD_W} floorY={floorY} look={look} />
      <KelpForest zoneIndex={zoneIndex} worldW={WORLD_W} floorY={floorY} lite={lite} />
      <Seagrass zoneIndex={zoneIndex} worldW={WORLD_W} floorY={floorY} lite={lite} />
      <DeepLife zoneIndex={zoneIndex} worldW={WORLD_W} floorY={floorY} lite={lite} />
      {zoneIndex === 0 && <SurfaceFromBelow worldW={WORLD_W} />}
      <SunShafts zoneIndex={zoneIndex} worldW={WORLD_W} floorY={floorY} />
      <MarineSnow zoneIndex={zoneIndex} worldW={WORLD_W} floorY={floorY} lite={lite} />
      <Suspense fallback={null}><Scenery zoneIndex={zoneIndex} worldW={WORLD_W} floorY={floorY} /></Suspense>
      {cruisers.map((c, i) => <Suspense key={i} fallback={null}><Cruiser {...c} /></Suspense>)}
    </Canvas>
  );
}
