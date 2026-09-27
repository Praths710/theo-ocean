import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODEL_CONFIG, type ModelId } from "./modelConfig";

// A downloaded GLB, re-oriented so it faces +X (head right, back up), scaled to a target body
// length in world units, centred at the origin, with its best swim clip playing. Models without
// a skeleton get a procedural swim (a travelling bend wave, or a flutter-kick for the diver).

const MESHOPT = true;

export function preloadModel(id: ModelId) {
  const cfg = MODEL_CONFIG[id];
  if (cfg) useGLTF.preload(cfg.file, false, MESHOPT);
}

type SwimUniforms = { uTime: { value: number }; uAmp: { value: number }; uFreq: { value: number }; uSpeed: { value: number }; uLen: { value: number }; uMode: { value: number }; uInvWorld: { value: THREE.Matrix4 }; uWorld: { value: THREE.Matrix4 } };

/** Adds a travelling-wave bend (fish) or leg kick (diver) to a material, in actor space. */
function addSwim(material: THREE.Material, u: SwimUniforms, suit?: SuitUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    if (suit) {
      Object.assign(shader.uniforms, suit);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uSuit; uniform float uSuitOn;")
        .replace("#include <map_fragment>", SUIT_GLSL);
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uSpeed; uniform float uLen; uniform float uMode;
uniform mat4 uInvWorld; uniform mat4 uWorld;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  // Work in actor space (x = head->tail axis, normalised by body length).
  vec4 a = uInvWorld * modelMatrix * vec4(transformed, 1.0);
  float s = a.x / uLen; // -0.5 tail .. +0.5 head
  vec3 d = vec3(0.0);
  if (uMode < 0.5) {
    float w = smoothstep(0.35, -0.5, s);                  // head stiff, tail loose
    d.z = sin(s * uFreq - uTime * uSpeed) * uAmp * uLen * w;
  } else {
    float legs = smoothstep(-0.05, -0.35, s);             // only behind the hips
    float side = sign(a.z + 1e-4);                        // left/right leg alternate
    d.y = sin(uTime * uSpeed + side * 1.5708) * uAmp * uLen * legs * (0.4 + (-s) * 1.6);
    // T-pose arms -> swept back along the body: anything wider than the shoulders folds backwards.
    float shoulder = 0.1 * uLen;
    float spread = abs(a.z) - shoulder;
    if (spread > 0.0 && s > 0.1) {
      d.z += -side * spread * 0.92;
      d.x += -spread * 0.95;
      d.y += -spread * 0.12;
    }
  }
  vec4 back = inverse(modelMatrix) * (uWorld * vec4(d, 0.0)); // actor space -> mesh space
  transformed += back.xyz;
}`);
  };
  if (suit) material.customProgramCacheKey = () => "suit"; // same callback source as other parts: keep programs apart
  material.needsUpdate = true;
}

type SuitUniforms = { uSuit: { value: THREE.Color }; uSuitOn: { value: number } };

// Wetsuit recolour: the suit fabric is dark and grey in the texture, so only those texels take the
// player's colour (keeping the fabric shading); skin, mask, trims and highlights stay as they are.
const SUIT_GLSL = `#include <map_fragment>
{
  vec3 t = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2)); // texture is linear here; judge it as painted (sRGB)
  float lum = dot(t, vec3(0.299, 0.587, 0.114));
  float sat = max(t.r, max(t.g, t.b)) - min(t.r, min(t.g, t.b));
  float mask = (1.0 - smoothstep(0.05, 0.12, sat)) * (1.0 - smoothstep(0.28, 0.4, lum)) * smoothstep(0.02, 0.06, lum) * uSuitOn;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSuit * (0.55 + lum * 3.0), mask);
}`;

/** `tempo`: animation speed multiplier read every frame (e.g. faster kicks when swimming fast). */
/** `suit`: optional wetsuit colour (diver only). */
export default function ModelActor({ id, length, children, onReady, tempo, suit }: { id: ModelId; length?: number; children?: ReactNode; onReady?: () => void; tempo?: { current: number }; suit?: string }) {
  const cfg = MODEL_CONFIG[id];
  const { scene, animations } = useGLTF(cfg.file, false, MESHOPT);
  const root = useRef<THREE.Group>(null);
  const actor = useRef<THREE.Group>(null);
  const model = useMemo(() => cloneSkinned(scene) as THREE.Group, [scene]);
  const { actions, names } = useAnimations(animations, model);
  const target = length ?? cfg.length;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const uniforms = useMemo<SwimUniforms>(() => ({
    uTime: { value: 0 }, uAmp: { value: cfg.swim?.amp ?? 0 }, uFreq: { value: cfg.swim?.freq ?? 6 }, uSpeed: { value: cfg.swim?.speed ?? 4 },
    uLen: { value: target }, uMode: { value: cfg.swim?.mode === "kick" ? 1 : 0 }, uInvWorld: { value: new THREE.Matrix4() }, uWorld: { value: new THREE.Matrix4() },
  }), [cfg, target]);

  const suitU = useMemo<SuitUniforms>(() => ({ uSuit: { value: new THREE.Color() }, uSuitOn: { value: 0 } }), []);
  useEffect(() => {
    suitU.uSuitOn.value = suit ? 1 : 0;
    if (suit) suitU.uSuit.value.set(suit).convertSRGBToLinear();
  }, [suit, suitU]);

  // Orient, normalise size, centre; clone materials so per-actor shader tweaks don't leak.
  useLayoutEffect(() => {
    model.rotation.set(...cfg.rot);
    model.position.set(0, 0, 0);
    model.scale.setScalar(1);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    const s = target / Math.max(cfg.fit === "max" ? Math.max(size.x, size.y, size.z) : size.x, 1e-6);
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model, true);
    const c = box2.getCenter(new THREE.Vector3());
    model.position.sub(c);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false; // skinned bounds are unreliable
      m.castShadow = false;
      m.userData.origMaterial ??= m.material; // always derive from the original, so re-runs never stack tints
      const orig = m.userData.origMaterial as THREE.Material | THREE.Material[];
      const mats = (Array.isArray(orig) ? orig : [orig]).map((mat) => {
        const c2 = mat.clone() as THREE.MeshStandardMaterial;
        if (cfg.tint && "color" in c2) c2.color.multiply(new THREE.Color(cfg.tint));
        if (cfg.emissive && "emissive" in c2) { c2.emissive = new THREE.Color(cfg.emissive); c2.emissiveIntensity = cfg.emissiveIntensity ?? 0.6; }
        if ("roughness" in c2 && cfg.wet) c2.roughness = Math.min(c2.roughness, 0.45);
        if (cfg.swim && !names.length) addSwim(c2, uniforms, id === "diver" && mat.name === "Diver_Body" ? suitU : undefined);
        return c2;
      });
      m.material = Array.isArray(orig) ? mats : mats[0];
    });
    readyRef.current?.();
  }, [model, cfg, target, names.length, uniforms, id, suitU]);

  // Play the best swim clip.
  useEffect(() => {
    if (!names.length) return;
    const pref = cfg.clip ? names.find((n) => cfg.clip!.test(n)) : undefined;
    const name = pref ?? names.find((n) => /swim|swimming|anim|take|action/i.test(n)) ?? names[0];
    const a = actions[name];
    a?.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveTimeScale(cfg.clipSpeed ?? 1).play();
    return () => { a?.stop(); };
  }, [actions, names, cfg]);

  useFrame((_, delta) => {
    const k = tempo?.current ?? 1;
    uniforms.uTime.value += delta * k;
    if (tempo) for (const a of Object.values(actions)) a?.setEffectiveTimeScale((cfg.clipSpeed ?? 1) * k);
    if (actor.current) {
      actor.current.updateMatrixWorld();
      uniforms.uWorld.value.copy(actor.current.matrixWorld);
      uniforms.uInvWorld.value.copy(actor.current.matrixWorld).invert();
    }
  });

  return (
    <group ref={root}>
      <group ref={actor}>
        <primitive object={model} />
        {children}
      </group>
    </group>
  );
}
