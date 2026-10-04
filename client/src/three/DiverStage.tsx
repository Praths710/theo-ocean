import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import ModelActor, { preloadModel, type GearLook } from "./ModelActor";
import UnderwaterEnv from "./UnderwaterEnv";
import { isIntegratedGpu } from "./gpu";

// The same 3D diver as in the game, hovering and finning gently for the home screen and locker.

preloadModel("diver");

function Hover({ look, onReady, length, yaw }: { look: GearLook; onReady?: () => void; length: number; yaw: number }) {
  const group = useRef<THREE.Group>(null);
  const tempo = useRef(0.55);
  const effort = useRef(0.25);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (!group.current) return;
    group.current.position.y = Math.sin(t.current * 1.1) * 0.08;
    group.current.rotation.set(Math.sin(t.current * 0.7) * 0.04, yaw + Math.sin(t.current * 0.35) * 0.12, 0.06 + Math.sin(t.current * 0.9) * 0.03);
  });
  return (
    <group ref={group}>
      <ModelActor id="diver" length={length} tempo={tempo} effort={effort} look={look} onReady={onReady} />
    </group>
  );
}

export default function DiverStage({ look, className, onReady, length = 4.3, yaw = -0.45 }: { look: GearLook; className?: string; onReady?: () => void; length?: number; yaw?: number }) {
  return (
    <Canvas className={className} dpr={isIntegratedGpu() ? 1 : [1, 2]} camera={{ position: [0, 0.35, 5.2], fov: 38 }} gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15; }}>
      <hemisphereLight args={["#bff3ff", "#0a2a3c", 1.1]} />
      <UnderwaterEnv intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff4e0" />
      <directionalLight position={[-4, 1, -3]} intensity={1.4} color="#5fe3ff" />
      <Suspense fallback={null}><Hover look={look} onReady={onReady} length={length} yaw={yaw} /></Suspense>
    </Canvas>
  );
}
