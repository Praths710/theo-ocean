import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// What makes the water itself read as water, in 3D so it has real depth and parallax:
//  - sun shafts slanting down from the surface (shallow zones), shimmering as the surface moves;
//  - suspended particles / marine snow drifting at many depths;
//  - the underside of the surface overhead in the sunlit zone, rippling and bright.

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const RAYS = [0.2, 0.08, 0, 0, 0];
const SNOW = [
  { count: 900, color: "#e8fbff", size: 7, drift: 0.05 },
  { count: 900, color: "#cfe7ff", size: 7, drift: 0.06 },
  { count: 1100, color: "#d9ecff", size: 6.5, drift: 0.08 },
  { count: 1100, color: "#dde6f0", size: 6, drift: 0.09 },
  { count: 1000, color: "#e0e6ee", size: 6, drift: 0.1 },
];

/** Volumetric-looking light shafts: soft additive slabs from the surface, flickering with the swell. */
export function SunShafts({ zoneIndex, worldW, floorY }: { zoneIndex: number; worldW: number; floorY: number }) {
  const strength = RAYS[zoneIndex] ?? 0;
  const shafts = useMemo(() => {
    const r = rng(91 + zoneIndex);
    const n = Math.round(worldW / 4.5);
    return Array.from({ length: n }, (_, i) => ({ x: (i + r()) * (worldW / n), z: -2 - r() * 11, w: 0.8 + r() * 2.6, tilt: 0.22 + r() * 0.12, seed: r() * 100, k: 0.5 + r() * 0.8 }));
  }, [worldW, zoneIndex]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: strength } }), [strength]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uSeed: { value: 0 }, uK: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uStrength; uniform float uSeed; uniform float uK; varying vec2 vUv;
      void main() {
        float across = sin(3.14159 * vUv.x); across *= across;               // soft edges
        float fall = pow(vUv.y, 1.6);                                         // strongest near the surface
        float streaks = 0.6 + 0.4 * sin(vUv.x * 18.0 + uSeed + sin(uTime * 0.4 + uSeed) * 2.0);
        float flicker = 0.55 + 0.45 * sin(uTime * 0.6 * uK + uSeed) * sin(uTime * 0.23 + uSeed * 1.7);
        gl_FragColor = vec4(vec3(0.75, 0.94, 1.0), across * fall * streaks * flicker * uStrength);
      }`,
  }), [uniforms]);
  const materials = useMemo(() => shafts.map((s) => { const m = mat.clone(); m.uniforms = { ...uniforms, uSeed: { value: s.seed }, uK: { value: s.k } }; return m; }), [shafts, mat, uniforms]);
  useFrame((_, dt) => { uniforms.uTime.value += dt; });
  if (!strength) return null;
  const height = -floorY + 2;
  return (
    <>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, floorY + height / 2 - 0.3, s.z]} rotation={[0, 0, s.tilt]} material={materials[i]} renderOrder={2}>
          <planeGeometry args={[s.w, height * 1.15]} />
        </mesh>
      ))}
    </>
  );
}

/** Suspended particles at many depths; they drift down slowly and sway with the water. */
export function MarineSnow({ zoneIndex, worldW, floorY, lite }: { zoneIndex: number; worldW: number; floorY: number; lite: boolean }) {
  const cfg = SNOW[zoneIndex] ?? SNOW[0];
  const count = Math.round(cfg.count * (lite ? 0.5 : 1) * Math.min(2, worldW / 40 + 0.5));
  const { geo, uniforms } = useMemo(() => {
    const r = rng(55 + zoneIndex);
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r() * (worldW + 8) - 4;
      pos[i * 3 + 1] = floorY + r() * (-floorY + 1);
      pos[i * 3 + 2] = 3.5 - r() * 20;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return { geo: g, uniforms: { uTime: { value: 0 }, uTop: { value: 1 }, uBottom: { value: floorY }, uColor: { value: new THREE.Color(cfg.color) }, uSize: { value: cfg.size }, uDrift: { value: cfg.drift } } };
  }, [count, worldW, floorY, zoneIndex, cfg]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float aSeed; uniform float uTime; uniform float uTop; uniform float uBottom; uniform float uSize; uniform float uDrift;
      varying float vA;
      void main() {
        vec3 p = position;
        float range = uTop - uBottom;
        p.y = uBottom + mod(p.y - uBottom - uTime * uDrift * (0.5 + aSeed), range);
        p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.25;
        p.z += cos(uTime * 0.25 + aSeed * 23.0) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = uSize * (0.4 + aSeed) * (10.0 / d);
        vA = (0.25 + 0.55 * aSeed) * smoothstep(34.0, 8.0, d) * smoothstep(1.5, 4.0, d); // fade far away and right at the lens
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(uColor, vA * smoothstep(0.5, 0.0, r)); }`,
  }), [uniforms]);
  useFrame((_, dt) => { uniforms.uTime.value += dt; });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />;
}

/** The underside of the surface seen from below: bright, wobbling ripples fading into the distance. */
export function SurfaceFromBelow({ worldW }: { worldW: number }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vW;
      float wave(vec2 p) { return sin(p.x * 1.7 + uTime * 0.9) * 0.5 + sin(p.y * 2.3 - uTime * 0.7 + p.x * 0.6) * 0.35 + sin((p.x + p.y) * 3.9 + uTime * 1.6) * 0.15; }
      void main() {
        vec2 p = vW.xz;
        float e = 0.05;
        vec2 g = vec2(wave(p + vec2(e, 0.0)) - wave(p - vec2(e, 0.0)), wave(p + vec2(0.0, e)) - wave(p - vec2(0.0, e))) / (2.0 * e);
        float sparkle = pow(clamp(1.0 - length(g) * 0.35, 0.0, 1.0), 6.0);      // bright where the surface is flat
        float net = smoothstep(0.55, 1.0, sin(p.x * 3.0 + g.x) * sin(p.y * 3.0 + g.y) * 0.5 + 0.5);
        float dist = smoothstep(-42.0, -4.0, vW.z);                            // fade out towards the horizon
        vec3 col = mix(vec3(0.35, 0.72, 0.85), vec3(0.9, 1.0, 1.0), sparkle * 0.7 + net * 0.3);
        gl_FragColor = vec4(col, (0.18 + sparkle * 0.35 + net * 0.15) * dist);
      }`,
  }), [uniforms]);
  useFrame((_, dt) => { uniforms.uTime.value += dt; });
  return (
    <mesh position={[worldW / 2, 0.35, -20]} rotation={[Math.PI / 2, 0, 0]} material={mat} renderOrder={1}>
      <planeGeometry args={[worldW + 80, 46, 1, 1]} />
    </mesh>
  );
}
