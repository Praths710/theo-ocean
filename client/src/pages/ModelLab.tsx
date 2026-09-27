// Dev-only page (/lab): shows models with a red +X ("head") arrow and green +Y ("back") arrow,
// used to set each model's orientation in modelConfig.ts. Not included in production.
//   /lab                      all models (side view)
//   /lab?only=whale&rot=0,90,0 one model: side, top and front views, with a trial rotation (degrees)
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import ModelActor from "@/three/ModelActor";
import { MODEL_CONFIG, type ModelId } from "@/three/modelConfig";

const q = new URLSearchParams(location.search);
const only = q.get("only")?.split(",").filter(Boolean) as ModelId[] | undefined;
const trial = q.get("rot")?.split(",").map((d) => (Number(d) * Math.PI) / 180) as [number, number, number] | undefined;
const list = only?.length ? only : (Object.keys(MODEL_CONFIG) as ModelId[]);
if (trial && list.length === 1) MODEL_CONFIG[list[0]].rot = trial;

const Arrows = ({ at }: { at: [number, number, number] }) => (
  <>
    <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(...at), 3.2, 0xff3333]} />
    <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(...at), 1.2, 0x33ff33]} />
  </>
);

function Grid() {
  return (
    <>
      {list.map((id, i) => {
        const x = (i % 6) * 4 - 10, y = -Math.floor(i / 6) * 3.2 + 3.5;
        return (
          <group key={id} position={[x, y, 0]}>
            <Suspense fallback={null}><ModelActor id={id} length={3} /></Suspense>
            <Arrows at={[-1.6, -1.1, 0]} />
            <Html position={[0, -1.5, 0]} center style={{ color: "#fff", font: "12px monospace", whiteSpace: "nowrap" }}>{id}</Html>
          </group>
        );
      })}
    </>
  );
}

function Single({ id }: { id: ModelId }) {
  const views: { label: string; pos: [number, number, number]; rot: [number, number, number] }[] = [
    { label: "SIDE (should: head right, back up)", pos: [-6, 1.5, 0], rot: [0, 0, 0] },
    { label: "TOP (looking down on its back)", pos: [0, 1.5, 0], rot: [Math.PI / 2, 0, 0] },
    { label: "FRONT (looking at its face)", pos: [6, 1.5, 0], rot: [0, -Math.PI / 2, 0] },
  ];
  return (
    <>
      {views.map((v) => (
        <group key={v.label} position={v.pos}>
          <group rotation={v.rot}><Suspense fallback={null}><ModelActor id={id} length={4.5} /></Suspense></group>
          <Html position={[0, -3.2, 0]} center style={{ color: "#fff", font: "13px monospace", whiteSpace: "nowrap" }}>{v.label}</Html>
        </group>
      ))}
      <Arrows at={[-8.2, -1.8, 0]} />
      <Html position={[0, 4.4, 0]} center style={{ color: "#ffd166", font: "15px monospace", whiteSpace: "nowrap" }}>{id} rot = {(MODEL_CONFIG[id].rot.map((r) => Math.round((r * 180) / Math.PI))).join(", ")}</Html>
    </>
  );
}

export default function ModelLab() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#1d3a4a" }}>
      <Canvas orthographic camera={{ position: [0, 0, 50], zoom: list.length === 1 ? 60 : 36 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 10, 8]} intensity={2.2} />
        {list.length === 1 ? <Single id={list[0]} /> : <Grid />}
      </Canvas>
    </div>
  );
}
