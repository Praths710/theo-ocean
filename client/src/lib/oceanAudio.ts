// Procedural underwater soundscape (Web Audio). No audio files needed.
// Layers: deep rumble, swelling water flow, regulator breathing + bubbles, and zone-specific
// wildlife: whale song, porpoise clicks, sperm-whale click trains, sonar pings, trench creaks.

type Ctx = {
  ac: AudioContext;
  master: GainNode;
  bed: GainNode; // ambience bus (ducked while the companion speaks)
  sfx: GainNode;
  reverb: ConvolverNode;
  rumbleFilter: BiquadFilterNode;
  flowGain: GainNode;
  timers: number[];
};

let ctx: Ctx | null = null;
let zone = 0;
let muted = false;
let onBreath: (() => void) | null = null;

function noiseBuffer(ac: AudioContext, seconds: number, brown = false) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; } else d[i] = white;
  }
  return buf;
}

function impulse(ac: AudioContext, seconds = 3.5, decay = 2.8) {
  const len = ac.sampleRate * seconds;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function loopNoise(c: Ctx, brown: boolean) {
  const src = c.ac.createBufferSource();
  src.buffer = noiseBuffer(c.ac, 4, brown);
  src.loop = true;
  src.start();
  return src;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function every(c: Ctx, min: number, max: number, fn: () => void) {
  const tick = () => { fn(); c.timers.push(window.setTimeout(tick, rand(min, max) * 1000)); };
  c.timers.push(window.setTimeout(tick, rand(min * 0.4, max * 0.6) * 1000));
}

// ---------- voices ----------

function bubble(c: Ctx, when: number, size = 1) {
  const o = c.ac.createOscillator();
  const g = c.ac.createGain();
  const f0 = rand(380, 900) / size;
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f0 * rand(1.8, 2.6), when + 0.09);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.05 * size, when + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
  o.connect(g); g.connect(c.bed); g.connect(c.reverb);
  o.start(when); o.stop(when + 0.14);
}

function breath(c: Ctx) {
  const t = c.ac.currentTime;
  // inhale: airy regulator hiss
  const src = c.ac.createBufferSource(); src.buffer = noiseBuffer(c.ac, 1.2);
  const bp = c.ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.8;
  const g = c.ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 1.1);
  src.connect(bp); bp.connect(g); g.connect(c.bed);
  src.start(t); src.stop(t + 1.2);
  // exhale: burst of bubbles ~1.6s later
  const ex = t + 1.6;
  const n = Math.floor(rand(10, 18));
  for (let i = 0; i < n; i++) bubble(c, ex + i * rand(0.03, 0.08), rand(0.7, 1.4));
  window.setTimeout(() => onBreath?.(), 1600);
}

function whaleSong(c: Ctx, low = false) {
  const t = c.ac.currentTime;
  const dur = rand(2.5, 4.5);
  const base = low ? rand(70, 110) : rand(140, 260);
  const out = c.ac.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.09, t + 0.6);
  out.gain.setValueAtTime(0.09, t + dur - 0.8);
  out.gain.linearRampToValueAtTime(0, t + dur);
  const lp = c.ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
  const vib = c.ac.createOscillator(); vib.frequency.value = rand(3, 6);
  const vibG = c.ac.createGain(); vibG.gain.value = base * 0.02; vib.connect(vibG);
  const curve = new Float32Array(32).map((_, i) => base * (1 + 0.6 * Math.sin((i / 31) * Math.PI * rand(0.8, 1.6)) + (i / 31) * rand(-0.3, 0.5)));
  for (const [mult, amp] of [[1, 1], [2, 0.35], [3, 0.12]] as const) {
    const o = c.ac.createOscillator(); o.type = "sawtooth";
    const g = c.ac.createGain(); g.gain.value = amp * 0.4;
    o.frequency.setValueCurveAtTime(curve.map((f) => f * mult), t, dur);
    vibG.connect(o.frequency);
    o.connect(g); g.connect(lp);
    o.start(t); o.stop(t + dur);
  }
  vib.start(t); vib.stop(t + dur);
  lp.connect(out); out.connect(c.reverb); out.connect(c.bed);
}

function clicks(c: Ctx, count: number, gap: number, freq: number, level = 0.05) {
  const t = c.ac.currentTime;
  for (let i = 0; i < count; i++) {
    const w = t + i * gap * rand(0.85, 1.15);
    const src = c.ac.createBufferSource(); src.buffer = noiseBuffer(c.ac, 0.02);
    const bp = c.ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 3;
    const g = c.ac.createGain(); g.gain.setValueAtTime(level, w); g.gain.exponentialRampToValueAtTime(0.0001, w + 0.02);
    src.connect(bp); bp.connect(g); g.connect(c.bed); g.connect(c.reverb);
    src.start(w); src.stop(w + 0.03);
  }
}

function ping(c: Ctx) {
  const t = c.ac.currentTime;
  const o = c.ac.createOscillator(); o.frequency.value = rand(900, 1300);
  const g = c.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  o.connect(g); g.connect(c.reverb);
  o.start(t); o.stop(t + 2);
}

function creak(c: Ctx) {
  const t = c.ac.currentTime;
  const o = c.ac.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(rand(40, 70), t); o.frequency.linearRampToValueAtTime(rand(25, 45), t + 1.5);
  const lp = c.ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
  const g = c.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 1.6);
  o.connect(lp); lp.connect(g); g.connect(c.reverb); g.connect(c.bed);
  o.start(t); o.stop(t + 1.7);
}

// ---------- public API ----------

export const oceanAudio = {
  /** Must be called from a user gesture (click/tap). Safe to call repeatedly. */
  start() {
    if (ctx) { void ctx.ac.resume(); return; }
    const ac = new AudioContext();
    const master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    const bed = ac.createGain(); bed.gain.value = 1; bed.connect(master);
    const sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
    const reverb = ac.createConvolver(); reverb.buffer = impulse(ac);
    const revGain = ac.createGain(); revGain.gain.value = 0.55; reverb.connect(revGain); revGain.connect(bed);

    // deep rumble
    const rumbleFilter = ac.createBiquadFilter(); rumbleFilter.type = "lowpass"; rumbleFilter.frequency.value = 380;
    const rumbleGain = ac.createGain(); rumbleGain.gain.value = 0.55;
    const c: Ctx = { ac, master, bed, sfx, reverb, rumbleFilter, flowGain: ac.createGain(), timers: [] };
    loopNoise(c, true).connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(bed);

    // water flow: band-passed noise that swells like currents
    const flowBp = ac.createBiquadFilter(); flowBp.type = "bandpass"; flowBp.frequency.value = 520; flowBp.Q.value = 0.6;
    c.flowGain.gain.value = 0.05;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ac.createGain(); lfoG.gain.value = 0.035;
    lfo.connect(lfoG); lfoG.connect(c.flowGain.gain); lfo.start();
    const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.031;
    const lfo2G = ac.createGain(); lfo2G.gain.value = 220;
    lfo2.connect(lfo2G); lfo2G.connect(flowBp.frequency); lfo2.start();
    loopNoise(c, false).connect(flowBp); flowBp.connect(c.flowGain); c.flowGain.connect(bed);

    ctx = c;
    every(c, 4.6, 6.2, () => breath(c));
    every(c, 14, 30, () => {
      if (zone === 0) Math.random() < 0.6 ? whaleSong(c) : clicks(c, 14, 0.05, 6000, 0.03); // blue whale / porpoise
      else if (zone === 1) Math.random() < 0.5 ? whaleSong(c, true) : ping(c);
      else if (zone === 2) Math.random() < 0.6 ? clicks(c, 22, rand(0.4, 0.7), 2500, 0.07) : whaleSong(c, true); // sperm whale
      else if (zone === 3) Math.random() < 0.5 ? ping(c) : creak(c);
      else creak(c);
    });
    every(c, 1.5, 4, () => { for (let i = 0; i < 3; i++) bubble(c, c.ac.currentTime + i * 0.07, rand(0.4, 0.8)); });
    this.setZone(zone);
  },

  setZone(level: number) {
    zone = level;
    if (!ctx) return;
    const t = ctx.ac.currentTime;
    ctx.rumbleFilter.frequency.linearRampToValueAtTime([420, 320, 220, 160, 120][level] ?? 200, t + 3);
    ctx.flowGain.gain.linearRampToValueAtTime([0.06, 0.045, 0.03, 0.02, 0.015][level] ?? 0.02, t + 3);
  },

  /** Lower the ambience while the companion talks. */
  duck(on: boolean) {
    if (!ctx) return;
    ctx.bed.gain.setTargetAtTime(on ? 0.35 : 1, ctx.ac.currentTime, 0.3);
  },

  setMuted(m: boolean) {
    muted = m;
    if (ctx) ctx.master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.ac.currentTime, 0.1);
  },
  isMuted: () => muted,

  onBreath(fn: (() => void) | null) { onBreath = fn; },

  sfx(kind: "scan" | "xp" | "dive" | "click" | "lock") {
    if (!ctx) return;
    const c = ctx; const t = c.ac.currentTime;
    const tone = (f: number, at: number, len: number, type: OscillatorType = "sine", lvl = 0.12) => {
      const o = c.ac.createOscillator(); o.type = type; o.frequency.value = f;
      const g = c.ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(lvl, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(c.sfx); g.connect(c.reverb); o.start(at); o.stop(at + len + 0.05);
    };
    if (kind === "scan") {
      const o = c.ac.createOscillator(); o.frequency.setValueAtTime(400, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
      const g = c.ac.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); g.connect(c.sfx); g.connect(c.reverb); o.start(t); o.stop(t + 0.65);
    } else if (kind === "xp") { [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.08, 0.5, "triangle", 0.08)); }
    else if (kind === "click") tone(1200, t, 0.08, "sine", 0.05);
    else if (kind === "lock") { tone(220, t, 0.25, "square", 0.04); tone(180, t + 0.12, 0.3, "square", 0.04); }
    else if (kind === "dive") {
      const src = c.ac.createBufferSource(); src.buffer = noiseBuffer(c.ac, 2.5);
      const bp = c.ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(2000, t); bp.frequency.exponentialRampToValueAtTime(200, t + 2.2);
      const g = c.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 2.4);
      src.connect(bp); bp.connect(g); g.connect(c.sfx); src.start(t); src.stop(t + 2.5);
      for (let i = 0; i < 30; i++) bubble(c, t + i * 0.05, rand(0.6, 1.6));
    }
  },

  stop() {
    if (!ctx) return;
    ctx.timers.forEach((id) => clearTimeout(id));
    void ctx.ac.close();
    ctx = null;
  },
};
