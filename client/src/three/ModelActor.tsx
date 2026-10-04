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

type SwimUniforms = { uTime: { value: number }; uAmp: { value: number }; uFreq: { value: number }; uSpeed: { value: number }; uLen: { value: number }; uMode: { value: number }; uEffort: { value: number } };
/** Mesh space <-> actor space. A mesh never moves inside its actor, so these are fixed per mesh. */
type MeshSpace = { uToActor: { value: THREE.Matrix4 }; uFromActor: { value: THREE.Matrix4 } };

/** Adds a travelling-wave bend (fish) or leg kick (diver) to a material, in actor space. */
function addSwim(material: THREE.Material, u: SwimUniforms, space: MeshSpace, gear?: { u: GearUniforms; glsl: string; key: string }) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, space);
    if (gear) {
      Object.assign(shader.uniforms, gear.u);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uSuit; uniform vec3 uPanel; uniform vec3 uFins; uniform vec3 uTank; uniform float uGearOn; varying float vFin;")
        .replace("#include <map_fragment>", gear.glsl);
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uSpeed; uniform float uLen; uniform float uMode; uniform float uEffort;
uniform mat4 uToActor; uniform mat4 uFromActor;
varying float vFin;
${KICK_RIG}`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
if (uMode > 0.5) {
  // Bend normals with the joints (finite difference through the same rig) so lighting stays right.
  vec3 a0 = (uToActor * vec4(position, 1.0)).xyz;
  vec3 e = normalize(mat3(uToActor) * objectNormal) * 0.01 * uLen;
  objectNormal = normalize(mat3(uFromActor) * (rigKick(a0 + e) - rigKick(a0)));
}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  // Work in actor space (x = tail->head axis, normalised by body length).
  vec4 a = uToActor * vec4(transformed, 1.0);
  float s = a.x / uLen; // -0.5 tail .. +0.5 head
  vFin = smoothstep(-0.43, -0.455, s);
  vec3 d = vec3(0.0);
  if (uMode < 0.5) {
    float w = smoothstep(0.35, -0.5, s);                  // head stiff, tail loose
    d.z = sin(s * uFreq - uTime * uSpeed) * uAmp * uLen * w;
  } else {
    d = rigKick(a.xyz) - a.xyz;
  }
  vec4 back = uFromActor * vec4(d, 0.0); // actor space -> mesh space
  transformed += back.xyz;
}`);
  };
  if (gear) material.customProgramCacheKey = () => gear.key; // same callback source as other parts: keep programs apart
  material.needsUpdate = true;
}

// A small joint chain for the (unrigged, T-posed) diver, in actor space where x runs tail->head
// and s = x / length. Joint positions were measured with scripts/diver-profile.mjs.
// Real divers are calm: long, even fin strokes from the hips with softly bent knees, arms resting
// still along the body, head up. Only the legs cycle; everything else holds a relaxed pose, and
// every bend is modest with wide blends so the mesh never stretches.
const KICK_RIG = `
vec2 rot2(vec2 p, vec2 c, float ang) { p -= c; float cs = cos(ang), sn = sin(ang); return c + vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y); }
vec3 rigKick(vec3 a) {
  float L = uLen;
  float s = a.x / L;
  float side = a.z >= 0.0 ? 1.0 : -1.0;
  float ph = uTime * uSpeed + side * 3.14159;             // legs stroke in opposition
  float amp = 0.75 + 0.25 * uEffort;                      // nearly constant: same rhythm, a bit wider when fast
  float leg = smoothstep(0.004, 0.035, abs(a.z) / L);     // keep the crotch seam together
  vec3 p = a;
  // Ankles: feet pointed so the fins trail behind; the fins follow the stroke a little late.
  float wa = smoothstep(-0.425, -0.465, s);
  p.xy = rot2(p.xy, vec2(-0.445, 0.04) * L, wa * (-1.3 + leg * amp * 0.26 * sin(ph - 1.5)));
  // Knees: a soft bend that deepens slightly on the up-stroke.
  float wk = smoothstep(-0.21, -0.31, s);
  p.xy = rot2(p.xy, vec2(-0.26, 0.05) * L, -wk * leg * (0.14 + amp * 0.22 * (0.5 + 0.5 * sin(ph - 0.9))));
  // Hips: the stroke itself, long and even.
  float wh = smoothstep(-0.02, -0.16, s);
  p.xy = rot2(p.xy, vec2(-0.08, 0.04) * L, wh * leg * amp * 0.27 * sin(ph));
  // Upper body flows with the same rhythm as the legs (never faster), so the whole diver moves as one:
  // relaxed arms with a soft elbow, drifting a little against each kick; the torso rolls gently.
  float beat = sin(uTime * uSpeed);                       // left-leg stroke; right leg is the opposite
  float shoulderZ = 0.12 * L;
  float armSel = smoothstep(0.13, 0.23, s);
  float wArm = smoothstep(shoulderZ, shoulderZ + 0.08 * L, abs(a.z)) * armSel;
  float wFore = smoothstep(0.27 * L, 0.35 * L, abs(a.z)) * armSel;
  float armBeat = beat * side * -1.0;                     // each arm drifts against its own leg
  // Arms, as in a relaxed recreational diver: resting back along the body, the upper arm angled a
  // little below the torso, elbow softly bent, forearm and hand lying along the thigh. Built from
  // the T-pose in rest positions (elbow first), drifting gently with the kick rhythm.
  p.yz = rot2(p.yz, vec2(0.05 * L, side * 0.31 * L), -side * wFore * (0.5 + 0.04 * armBeat));
  p.xz = rot2(p.xz, vec2(0.3 * L, side * 0.31 * L), side * wFore * 0.3);
  p.yz = rot2(p.yz, vec2(0.05 * L, side * shoulderZ), side * wArm * (0.3 + 0.04 * armBeat));
  p.xz = rot2(p.xz, vec2(0.3 * L, side * shoulderZ), side * wArm * (1.5 + 0.05 * armBeat));
  // Head: raised to look ahead.
  float head = smoothstep(0.33, 0.37, s) * (1.0 - smoothstep(0.11, 0.15, a.y / L)) * (1.0 - wArm);
  p.xy = rot2(p.xy, vec2(0.345, 0.05) * L, head * 0.55);
  // Torso: a gentle roll with each kick and a slight rise and fall (carries head and arms; applied last).
  float upper = smoothstep(-0.08, 0.16, s);
  p.yz = rot2(p.yz, vec2(0.04, 0.0) * L, upper * 0.045 * beat);
  p.xy = rot2(p.xy, vec2(-0.05, 0.04) * L, upper * (0.012 * sin(uTime * uSpeed * 2.0 + 0.6) + 0.006 * sin(uTime * 1.1)));
  return p;
}`;

type GearUniforms = { uSuit: { value: THREE.Color }; uPanel: { value: THREE.Color }; uFins: { value: THREE.Color }; uTank: { value: THREE.Color }; uGearOn: { value: number } };
export type GearLook = { suit: string; panel: string; fins: string; tank: string };

// Diver outfit, painted over the original texture so the fabric weave, seams and shading stay.
// Colours are judged in sRGB (as painted). Texture coordinates are glTF's (v = 0 at the image top);
// the fin and tank areas were read off the texture sheets.
const GEAR_COMMON = `
  vec3 t = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2));
  float lum = dot(t, vec3(0.299, 0.587, 0.114));
  float sat = max(t.r, max(t.g, t.b)) - min(t.r, min(t.g, t.b));
  float grey = 1.0 - smoothstep(0.05, 0.12, sat);
  vec2 uv = vMapUv;`;
const BODY_GLSL = `#include <map_fragment>
{${GEAR_COMMON}
  // Neoprene: dark grey fabric. Main suit vs the lighter side panels, split by brightness.
  float fabric = grey * (1.0 - smoothstep(0.3, 0.42, lum)) * smoothstep(0.02, 0.06, lum);
  float panel = smoothstep(0.195, 0.23, lum);
  vec3 cloth = mix(uSuit, uPanel, panel) * (0.5 + lum * 2.4);
  // Fins (and foot pockets): picked by position on the body, everything past the ankles.
  float fin = vFin * grey;
  vec3 c = mix(diffuseColor.rgb, cloth, fabric * (1.0 - vFin) * uGearOn);
  c = mix(c, uFins * (0.45 + lum * 1.4), fin * uGearOn);
  diffuseColor.rgb = c;
}`;
const TANK_GLSL = `#include <map_fragment>
{${GEAR_COMMON}
  // The cylinder is the big light sheet at the lower right of the gear texture.
  float tankArea = step(0.43, uv.x) * step(0.5, uv.y) * step(uv.y, 0.94);
  float tank = tankArea * grey * smoothstep(0.35, 0.5, lum);
  diffuseColor.rgb = mix(diffuseColor.rgb, uTank * (0.45 + lum * 0.7), tank * uGearOn);
}`;

/** `tempo`: animation speed multiplier read every frame (e.g. faster kicks when swimming fast). */
/** `look`: outfit colours (diver only). `effort` (0..1): how hard the diver kicks. */
export default function ModelActor({ id, length, children, onReady, tempo, look, effort }: { id: ModelId; length?: number; children?: ReactNode; onReady?: () => void; tempo?: { current: number }; look?: GearLook; effort?: { current: number } }) {
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
    uLen: { value: target }, uMode: { value: cfg.swim?.mode === "kick" ? 1 : 0 }, uEffort: { value: 1 },
  }), [cfg, target]);

  const gearU = useMemo<GearUniforms>(() => ({ uSuit: { value: new THREE.Color() }, uPanel: { value: new THREE.Color() }, uFins: { value: new THREE.Color() }, uTank: { value: new THREE.Color() }, uGearOn: { value: 0 } }), []);
  useEffect(() => {
    gearU.uGearOn.value = look ? 1 : 0;
    if (!look) return;
    // Color.set() reads hex as sRGB and stores the linear working colour the shader expects.
    gearU.uSuit.value.set(look.suit);
    gearU.uPanel.value.set(look.panel);
    gearU.uFins.value.set(look.fins);
    gearU.uTank.value.set(look.tank);
  }, [look?.suit, look?.panel, look?.fins, look?.tank, gearU]); // eslint-disable-line react-hooks/exhaustive-deps

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
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Mesh space -> actor space: the local transforms from this mesh up to (and including) the model root.
      const toActor = new THREE.Matrix4();
      for (let n: THREE.Object3D | null = m; n; n = n === model ? null : n.parent) { n.updateMatrix(); toActor.premultiply(n.matrix); }
      const space: MeshSpace = { uToActor: { value: toActor }, uFromActor: { value: toActor.clone().invert() } };
      m.frustumCulled = false; // skinned bounds are unreliable
      m.castShadow = false;
      m.userData.origMaterial ??= m.material; // always derive from the original, so re-runs never stack tints
      const orig = m.userData.origMaterial as THREE.Material | THREE.Material[];
      const mats = (Array.isArray(orig) ? orig : [orig]).map((mat) => {
        let c2 = mat.clone() as THREE.MeshStandardMaterial;
        if (id === "diver" && (mat.name === "Diver_Body" || mat.name === "Diver_Objects")) {
          // Wet neoprene and a painted steel tank: a clear-coat layer gives the glossy highlights.
          const phys = new THREE.MeshPhysicalMaterial();
          THREE.MeshStandardMaterial.prototype.copy.call(phys, c2);
          phys.defines = { STANDARD: "", PHYSICAL: "" };
          phys.clearcoat = mat.name === "Diver_Body" ? 0.75 : 0.9;
          phys.clearcoatRoughness = mat.name === "Diver_Body" ? 0.28 : 0.15;
          phys.roughness = Math.min(phys.roughness, mat.name === "Diver_Body" ? 0.6 : 0.4);
          c2 = phys;
        }
        if (cfg.tint && "color" in c2) c2.color.multiply(new THREE.Color(cfg.tint));
        if (cfg.emissive && "emissive" in c2) { c2.emissive = new THREE.Color(cfg.emissive); c2.emissiveIntensity = cfg.emissiveIntensity ?? 0.6; }
        if ("roughness" in c2 && cfg.wet) c2.roughness = Math.min(c2.roughness, 0.45);
        if (cfg.solid) { c2.transparent = false; c2.opacity = 1; c2.depthWrite = true; c2.alphaTest = 0; }
        const gear = id !== "diver" ? undefined
          : mat.name === "Diver_Body" ? { u: gearU, glsl: BODY_GLSL, key: "diver-body" }
          : mat.name === "Diver_Objects" ? { u: gearU, glsl: TANK_GLSL, key: "diver-gear" } : undefined;
        if (id === "diver" && mat.name === "Diver_Objects") c2.metalness = Math.min(c2.metalness, 0.45); // painted tank, not bare chrome
        if (cfg.swim && !names.length) addSwim(c2, uniforms, space, gear);
        return c2;
      });
      m.material = Array.isArray(orig) ? mats : mats[0];
    });
    readyRef.current?.();
  }, [model, cfg, target, names.length, uniforms, id, gearU]);

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
    if (effort) uniforms.uEffort.value = effort.current;
    if (tempo) for (const a of Object.values(actions)) a?.setEffectiveTimeScale((cfg.clipSpeed ?? 1) * k);
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
