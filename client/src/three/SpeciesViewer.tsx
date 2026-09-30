import { Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ModelActor from "./ModelActor";
import UnderwaterEnv from "./UnderwaterEnv";
import { SPECIES_MODEL, type ModelId } from "./modelConfig";

// The species card's specimen: the same animated 3D model as in the dive, turning slowly so you
// can see it from the side and three-quarters. Species without a 3D model show `fallback`.

function Specimen({ id }: { id: ModelId }) {
  const group = useRef<THREE.Group>(null);
  const t = useRef(0);
  const tempo = useRef(0.8);
  // Fit the panel: it is often tall and narrow, and the animal turns, so leave room at the sides.
  const { viewport } = useThree();
  const length = Math.min(3.1, viewport.width * 0.78, viewport.height * 1.1);
  useFrame((_, dt) => {
    t.current += dt;
    if (!group.current) return;
    group.current.rotation.set(0.12, -0.35 + Math.sin(t.current * 0.35) * 0.75, 0);
    group.current.position.y = Math.sin(t.current * 0.9) * 0.06;
  });
  return (
    <group ref={group}>
      <ModelActor id={id} length={length} tempo={tempo} />
    </group>
  );
}

export default function SpeciesViewer({ speciesId, fallback, className }: { speciesId: string; fallback: ReactNode; className?: string }) {
  const id = SPECIES_MODEL[speciesId] as ModelId | undefined;
  if (!id) return <>{fallback}</>;
  return (
    <Canvas className={className} dpr={[1, 2]} camera={{ position: [0, 0.3, 5.4], fov: 36 }} gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.2; }}>
      <hemisphereLight args={["#cdf6ff", "#0b2a3a", 1.2]} />
      <UnderwaterEnv intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} color="#fff4e0" />
      <directionalLight position={[-4, 1, -3]} intensity={1.3} color="#62e0ff" />
      <Suspense fallback={null}><Specimen id={id} /></Suspense>
    </Canvas>
  );
}
