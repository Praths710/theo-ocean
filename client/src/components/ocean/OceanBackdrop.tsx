import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

// Realistic water: a WebGL fragment shader (depth gradient, god rays, caustics, surface
// shimmer, diver headlamp) plus a 2D particle layer (marine snow, bioluminescence, bubbles).

export type DiverProbe = { x: number; y: number; facing: 1 | -1 };
export type OceanHandle = { bubbles: (x: number, y: number, n: number, big?: boolean) => void };

type Palette = { top: [number, number, number]; bottom: [number, number, number]; light: number; bio: number };

export const ZONE_PALETTES: Palette[] = [
  { top: [0.2, 0.62, 0.78], bottom: [0.02, 0.24, 0.42], light: 1, bio: 0 },
  { top: [0.05, 0.3, 0.46], bottom: [0.01, 0.08, 0.18], light: 0.5, bio: 0.35 },
  { top: [0.02, 0.1, 0.18], bottom: [0.0, 0.025, 0.06], light: 0.12, bio: 0.8 },
  { top: [0.01, 0.06, 0.11], bottom: [0.0, 0.01, 0.03], light: 0.05, bio: 0.6 },
  { top: [0.008, 0.035, 0.07], bottom: [0.0, 0.004, 0.015], light: 0.02, bio: 0.5 },
];

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;
const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec3 uTop; uniform vec3 uBot; uniform float uLight; uniform vec2 uDiver; uniform float uLamp; uniform float uFacing; uniform float uCam;
varying vec2 vUv;
#define TAU 6.28318530718
float caustic(vec2 uv, float t){
  vec2 p = uv*TAU - 250.0; vec2 i = p; float c = 1.0; float inten = .005; // no mod(): wrapping made a seam
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n+1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0/length(vec2(p.x / (sin(i.x+tt)/inten), p.y / (cos(i.y+tt)/inten)));
  }
  c /= 4.0;
  if (!(c >= 0.0 && c < 1.0e4)) c = 1.0; // guard NaN/inf speckles
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 w = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), w.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), w.x), w.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a*vnoise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 uv = vUv; float y = 1.0 - uv.y; float aspect = uRes.x/uRes.y;
  vec2 rp = vec2((uv.x - 0.5)*aspect + uCam*0.45, y);
  // Base water colour with depth, plus light absorption (reds fade first, water turns blue-green).
  vec3 col = mix(uTop, uBot, smoothstep(0.0, 1.05, y));
  col *= mix(vec3(1.0), vec3(0.82, 0.97, 1.04), y);
  // Volumetric light shafts: slanted, soft, broken up by drifting particulate (fbm), not clean stripes.
  float ang = rp.x + y*0.38;
  float shafts = smoothstep(0.52, 0.95, fbm(vec2(ang*5.0, uTime*0.06)))
               + 0.7*smoothstep(0.58, 0.98, fbm(vec2(ang*11.0 + 7.3, uTime*0.09)));
  shafts *= smoothstep(1.0, 0.02, y) * (0.55 + 0.45*fbm(vec2(rp.x*2.5, y*4.0 - uTime*0.05)));
  col += vec3(0.62, 0.9, 1.0) * shafts * 0.34 * uLight;
  // Caustic net near the surface, fading with depth.
  float c = caustic(vec2(rp.x*1.1, y*1.5) + vec2(uTime*0.01, 0.0), uTime*0.32 + 23.0);
  col += vec3(0.55,0.95,1.0) * c * 0.28 * uLight * smoothstep(0.7, 0.0, y);
  // Caustics dancing on the sandy seafloor (sunlit reef).
  float floorBand = smoothstep(0.84, 0.96, y);
  float c2 = caustic(vec2(rp.x*1.7, y*2.6), uTime*0.42 + 11.0);
  col += vec3(0.55,0.9,0.9) * c2 * 0.3 * uLight * floorBand;
  // Surface seen from below: bright, rippling, with a glowing "Snell's window".
  float ripple = fbm(vec2(rp.x*9.0 + uTime*0.4, uTime*0.25));
  float surf = smoothstep(0.08, 0.0, y) * (0.35 + 0.65*ripple);
  float snell = exp(-pow((uv.x - 0.5)*1.6, 2.0) * 3.0) * smoothstep(0.35, 0.0, y);
  col += vec3(0.85,1.0,1.0) * (surf*0.35 + snell*0.12) * uLight;
  // Drifting murk.
  col = mix(col, uBot * 1.15, fbm(rp*1.4 + vec2(uTime*0.015, uTime*0.01)) * 0.16);
  vec2 d = vec2((uv.x - uDiver.x)*aspect, y - uDiver.y); // uDiver is in screen space
  float dist = length(d);
  vec2 dir = normalize(vec2(uFacing, 0.18));
  float cosA = dot(normalize(d + 1e-4), dir);
  float cone = smoothstep(0.86, 0.985, cosA) * exp(-dist*1.5) * step(0.02, dist);
  float halo = exp(-dist*dist*22.0);
  col += vec3(0.7,0.88,1.0) * uLamp * (halo*0.22 + cone*0.42);
  vec2 q = uv - 0.5; col *= 1.0 - dot(q,q)*0.95;
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5)/200.0;
  col = clamp(col, 0.0, 1.0);
  if (!(col.r >= 0.0 && col.g >= 0.0 && col.b >= 0.0)) col = uBot; // never output NaN pixels
  gl_FragColor = vec4(col, 1.0);
}`;

type Particle = { x: number; y: number; vx: number; vy: number; r: number; a: number; kind: 0 | 1 | 2; life: number; seed: number };

export default function OceanBackdrop({ ref, zoneIndex, diver, camera, className }: { ref?: Ref<OceanHandle>; zoneIndex: number; diver?: { current: DiverProbe }; camera?: { current: { x: number } }; className?: string }) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(ZONE_PALETTES[zoneIndex] ?? ZONE_PALETTES[0]);
  const bubbleQueue = useRef<Particle[]>([]);

  useEffect(() => { target.current = ZONE_PALETTES[zoneIndex] ?? ZONE_PALETTES[0]; }, [zoneIndex]);

  useImperativeHandle(ref, () => ({
    bubbles: (x, y, n, big) => {
      for (let i = 0; i < n; i++) {
        bubbleQueue.current.push({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 12, vy: -(30 + Math.random() * 40), r: (big ? 3 : 1.4) + Math.random() * (big ? 4 : 2.6), a: 0.9, kind: 2, life: 0, seed: Math.random() * 10 });
      }
    },
  }));

  useEffect(() => {
    const gl = glRef.current!.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    const fx = fxRef.current!.getContext("2d")!;
    let prog: WebGLProgram | null = null;
    const u: Record<string, WebGLUniformLocation | null> = {};
    if (gl) {
      const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ["uRes", "uTime", "uTop", "uBot", "uLight", "uDiver", "uLamp", "uFacing", "uCam"]) u[n] = gl.getUniformLocation(prog, n);
    }

    const cur = { top: [...target.current.top], bottom: [...target.current.bottom], light: target.current.light, bio: target.current.bio };
    let W = 0, H = 0;
    const snow: Particle[] = Array.from({ length: 140 }, () => ({ x: 0, y: 0, vx: 0, vy: 4 + Math.random() * 8, r: 0.5 + Math.random() * 1.6, a: 0.15 + Math.random() * 0.4, kind: 0, life: 0, seed: Math.random() * 100 }));
    const bio: Particle[] = Array.from({ length: 70 }, () => ({ x: 0, y: 0, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, r: 1 + Math.random() * 1.8, a: 0, kind: 1, life: 0, seed: Math.random() * 100 }));
    let seeded = false;
    let bubbles: Particle[] = [];
    const resize = () => {
      const el = glRef.current!.parentElement!;
      W = el.clientWidth; H = el.clientHeight;
      const s = Math.min(window.devicePixelRatio, 1) * (W < 900 ? 0.5 : 0.75); // shader at reduced res (it is soft); lighter on phones
      glRef.current!.width = Math.max(1, Math.floor(W * s)); glRef.current!.height = Math.max(1, Math.floor(H * s));
      const d = Math.min(window.devicePixelRatio, 2);
      fxRef.current!.width = W * d; fxRef.current!.height = H * d;
      fx.setTransform(d, 0, 0, d, 0, 0);
      // Scatter particles once we know the real size (it can be 0 at first layout, e.g. on mobile).
      if (!seeded && W > 0 && H > 0) {
        seeded = true;
        for (const p of [...snow, ...bio]) { p.x = Math.random() * W; p.y = Math.random() * H; }
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(glRef.current!.parentElement!);

    let raf = 0; let last = performance.now(); const t0 = last;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      const k = 1 - Math.pow(0.001, dt * 0.5); // ease toward target palette (~2s)
      for (let i = 0; i < 3; i++) { cur.top[i] += (target.current.top[i] - cur.top[i]) * k; cur.bottom[i] += (target.current.bottom[i] - cur.bottom[i]) * k; }
      cur.light += (target.current.light - cur.light) * k; cur.bio += (target.current.bio - cur.bio) * k;
      const dv = diver?.current;

      if (gl && prog) {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.uniform2f(u.uRes, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(u.uTime, t);
        gl.uniform3fv(u.uTop, cur.top); gl.uniform3fv(u.uBot, cur.bottom);
        gl.uniform1f(u.uLight, cur.light);
        gl.uniform2f(u.uDiver, dv ? dv.x / W : 0.5, dv ? dv.y / H : 0.5);
        gl.uniform1f(u.uLamp, dv ? Math.max(0, 1 - cur.light * 1.6) : 0);
        gl.uniform1f(u.uFacing, dv?.facing ?? 1);
        gl.uniform1f(u.uCam, (camera?.current.x ?? 0) / Math.max(1, H));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      fx.clearRect(0, 0, W, H);
      if (!seeded) { raf = requestAnimationFrame(frame); return; }
      // Particles scroll with the camera at a slower rate than the world (depth parallax).
      const cam = camera?.current.x ?? 0;
      const span = W + 20;
      const wrapX = (x: number, f: number) => ((((x - cam * f) % span) + span) % span) - 10;
      // marine snow
      const lamp = Math.max(0, 1 - cur.light * 1.6);
      for (const p of snow) {
        p.y += p.vy * dt; p.x += Math.sin(t * 0.5 + p.seed) * 6 * dt;
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
        const sx = wrapX(p.x, 0.25 + (p.r / 2.1) * 0.5);
        let a = p.a * (0.35 + cur.light * 0.65);
        if (dv && lamp > 0) { const d = Math.hypot(sx - dv.x, p.y - dv.y); a += lamp * Math.max(0, 1 - d / 260) * 0.8; }
        fx.fillStyle = `rgba(210,240,245,${a})`;
        fx.beginPath(); fx.arc(sx, p.y, p.r, 0, Math.PI * 2); fx.fill();
      }
      // bioluminescent plankton: twinkle, flare up when the diver swims past
      if (cur.bio > 0.02) {
        for (const p of bio) {
          p.x += (p.vx + Math.sin(t * 0.3 + p.seed) * 4) * dt; p.y += (p.vy + Math.cos(t * 0.27 + p.seed) * 3) * dt;
          if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
          const bx = wrapX(p.x, 0.85);
          let glow = Math.max(0, Math.sin(t * (0.6 + (p.seed % 1)) + p.seed)) ** 6;
          if (dv) { const d = Math.hypot(bx - dv.x, p.y - dv.y); if (d < 140) p.a = Math.min(1, p.a + dt * 4 * (1 - d / 140)); }
          p.a = Math.max(0, p.a - dt * 0.6);
          glow = Math.min(1, glow * 0.6 + p.a) * cur.bio;
          if (glow < 0.02) continue;
          const g = fx.createRadialGradient(bx, p.y, 0, bx, p.y, p.r * 7);
          const hue = p.seed % 3 < 2 ? "120,255,230" : "150,170,255";
          g.addColorStop(0, `rgba(${hue},${glow})`); g.addColorStop(1, `rgba(${hue},0)`);
          fx.fillStyle = g; fx.beginPath(); fx.arc(bx, p.y, p.r * 7, 0, Math.PI * 2); fx.fill();
        }
      }
      // bubbles
      if (bubbleQueue.current.length) { bubbles = bubbles.concat(bubbleQueue.current); bubbleQueue.current = []; }
      bubbles = bubbles.filter((b) => b.y > -20 && b.life < 12);
      for (const b of bubbles) {
        b.life += dt; b.vy -= 18 * dt; b.vy = Math.max(b.vy, -140);
        b.x += (b.vx + Math.sin(b.life * 7 + b.seed) * 16) * dt; b.vx *= 0.97; b.y += b.vy * dt;
        b.r = Math.min(b.r + dt * 0.8, 9);
        const a = Math.min(0.85, 0.3 + cur.light * 0.5 + lamp * 0.3);
        const x = b.x - cam; // bubbles live in world space
        if (x < -20 || x > W + 20) continue;
        fx.strokeStyle = `rgba(220,250,255,${a})`; fx.lineWidth = 1;
        fx.beginPath(); fx.ellipse(x, b.y, b.r, b.r * 0.9, 0, 0, Math.PI * 2); fx.stroke();
        fx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
        fx.beginPath(); fx.arc(x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.25), 0, Math.PI * 2); fx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [diver, camera]);

  return (
    <div className={`ocean-backdrop ${className ?? ""}`}>
      <canvas ref={glRef} className="ocean-gl" />
      <canvas ref={fxRef} className="ocean-fx" />
    </div>
  );
}
