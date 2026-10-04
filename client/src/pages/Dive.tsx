import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Brain, Home, Lock, MessageCircle, Mic, ShieldCheck, Volume2, VolumeX, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CHECKPOINT_QUESTIONS, diverLook, zones, type Species } from "@shared/ocean";
import OceanBackdrop, { type DiverProbe, type OceanHandle } from "@/components/ocean/OceanBackdrop";
import { SeascapeStrip } from "@/components/ocean/Seascape";
import Ocean3D from "@/three/Ocean3D";
import SpeciesCard from "@/components/SpeciesCard";
import { useProgress } from "@react-three/drei";
import { SPECIES_MODEL } from "@/three/modelConfig";
import Diver from "@/components/art/Diver";
import Creature, { type Art } from "@/components/art/Creature";
import { speciesArt } from "@/components/art/speciesArt";
import Companion, { MOOD_COLORS, type CompanionHandle } from "@/components/Companion";
import CheckpointQuiz from "@/components/CheckpointQuiz";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { oceanAudio } from "@/lib/oceanAudio";

const DEPTH_RANGES: [number, number][] = [[0, 200], [200, 1000], [1000, 4000], [4000, 6000], [6000, 10935]];
const WORLD_SCREENS = 4; // each zone is a side-scrolling level this many screens wide
const DIVER_W = 230;
const DIVER_H = DIVER_W * (120 / 300);
const FAR_PARALLAX = 0.35;

// Decorative fish schools per zone (not scannable, just life).
const SCHOOLS: { art: Art; size: number; count: number }[][] = [
  [{ art: { kind: "fish", body: "#ffd24a", belly: "#fff1b0" }, size: 34, count: 9 }, { art: { kind: "fish", body: "#3a7bd5", belly: "#bfe3ff" }, size: 30, count: 11 }],
  [{ art: { kind: "fish", body: "#9fb3c4", belly: "#e3edf5" }, size: 30, count: 12 }],
  [{ art: { kind: "lanternfish", body: "#2a3a4c", belly: "#6f8397", glow: "#8ff6ff" }, size: 32, count: 8 }],
  [],
  [],
];

// vx/vy: actual velocity (px/s). goal: the way it wants to swim; it steers there gradually and
// cool (seconds) blocks another change of mind, so animals never flicker back and forth.
type Swimmer = { id: string; x: number; y: number; vx: number; vy: number; baseX: number; baseY: number; dir: 1 | -1; goal: 1 | -1; cool: number; phase: number; w: number };
type School = { x: number; y: number; dir: 1 | -1; speed: number; phase: number; members: { dx: number; dy: number; ph: number }[]; scatter: number };

export default function Dive() {
  const { snap, apply, aiOnline } = useSession();
  const state = snap!.state;
  const maxZone = snap!.maxZoneIndex;
  const zoneIndex = Math.max(0, zones.findIndex((z) => z.id === state.zoneId));
  const zone = zones[zoneIndex];
  const nextZone = zones[zoneIndex + 1];

  const stage = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const farEl = useRef<HTMLDivElement>(null);
  const diverEl = useRef<HTMLDivElement>(null);
  const radarDiver = useRef<HTMLSpanElement>(null);
  const radarDots = useRef(new Map<string, HTMLSpanElement>());
  const ocean = useRef<OceanHandle>(null);
  const companion = useRef<CompanionHandle>(null);
  const probe = useRef<DiverProbe>({ x: 300, y: 300, facing: 1 });
  const camera = useRef({ x: 0 });
  const body = useRef({ x: window.innerWidth * 0.35, y: window.innerHeight * 0.42, vx: 0, vy: 0, facing: 1 as 1 | -1, kick: 0 });
  const keys = useRef(new Set<string>());
  const pointer = useRef<{ x: number; y: number } | null>(null); // screen coords
  const follow = useRef<string | null>(null);
  const swimmers = useRef<Swimmer[]>([]);
  const swimmerEls = useRef(new Map<string, HTMLDivElement>());
  const schools = useRef<School[]>([]);
  const schoolEls = useRef<(HTMLDivElement | null)[][]>([]);
  const depthEl = useRef<HTMLSpanElement>(null);
  const busyZone = useRef(false);

  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const worldW = view.w * WORLD_SCREENS;
  const [near, setNear] = useState<string | null>(null);
  const [edge, setEdge] = useState<"top" | "bottom" | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  // 3D models that have loaded: their 2D illustration is hidden (the DOM element stays as the click target).
  const [models3d, setModels3d] = useState<Record<string, boolean>>({});
  const onModelReady = useCallback((id: string) => setModels3d((m) => (m[id] ? m : { ...m, [id]: true })), []);
  const webgl2 = useMemo(() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } }, []);
  // While the 3D models download, show a loading screen rather than flat art that later pops into 3D.
  // If something is still missing after 20s, carry on with the illustration for that one.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [warmed3d, setWarmed3d] = useState(false);
  const loadProgress = useProgress((p) => p.progress);
  useEffect(() => {
    setLoadTimedOut(false);
    setWarmed3d(false);
    const t = setTimeout(() => setLoadTimedOut(true), 20_000);
    return () => clearTimeout(t);
  }, [zone.id]);
  const [transition, setTransition] = useState<"down" | "up" | null>(null);
  const [muted, setMuted] = useState(oceanAudio.isMuted());
  const [line, setLine] = useState({ text: "", mood: "curious", speaking: false, listening: false, thinking: false });
  const [lineVisible, setLineVisible] = useState(false);
  const nearRef = useRef<string | null>(null);
  // Latest unlock state for the keyboard handler.
  const maxZoneRef = useRef(maxZone);
  maxZoneRef.current = maxZone;
  // The checkpoint opens once CHECKPOINT_QUESTIONS creatures here are scanned (it asks about those).
  const cpNeeded = Math.min(CHECKPOINT_QUESTIONS, zone.species.length);
  const cpReadyRef = useRef(false);
  cpReadyRef.current = zone.species.filter((s) => state.discovered.includes(s.id)).length >= cpNeeded;
  const edgeRef = useRef<"top" | "bottom" | null>(null);

  const card = useMemo(() => zone.species.find((s) => s.id === cardId) ?? null, [zone, cardId]);

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- audio + greeting ----
  useEffect(() => {
    oceanAudio.start();
    oceanAudio.onBreath(() => {
      const b = body.current;
      const rx = b.facing === 1 ? (237 + 40) / 300 : 1 - (237 + 40) / 300;
      ocean.current?.bubbles(b.x - DIVER_W / 2 + rx * DIVER_W, b.y - DIVER_H / 2 + (62 / 120) * DIVER_H, 8 + Math.floor(Math.random() * 6));
    });
    const wake = () => oceanAudio.start();
    window.addEventListener("pointerdown", wake);
    return () => { oceanAudio.onBreath(null); window.removeEventListener("pointerdown", wake); oceanAudio.stop(); };
  }, []);
  useEffect(() => { oceanAudio.setZone(zoneIndex); }, [zoneIndex]);

  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const t = setTimeout(() => {
      const returning = state.discovered.length > 0;
      companion.current?.event(`${state.diver.name} just jumped into the water in the ${zone.name}. ${returning ? "They're a returning diver; welcome them back and reference something they found before." : "It's their very first dive! Greet them with real excitement, introduce yourself in one line, and tell them to swim around and press E near a creature to scan it."} Keep it short.`);
    }, 900);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- subtitles fade ----
  useEffect(() => {
    if (!line.text) return;
    setLineVisible(true);
    if (line.speaking || line.thinking) return;
    const t = setTimeout(() => setLineVisible(false), 7000);
    return () => clearTimeout(t);
  }, [line]);
  const onLine = useCallback((l: typeof line) => setLine(l), []);

  // ---- spawn creatures + schools across the whole level ----
  useEffect(() => {
    const W = view.w, H = view.h, WW = W * WORLD_SCREENS;
    const n = zone.species.length;
    swimmers.current = zone.species.map((s, i) => {
      const a = speciesArt[s.id];
      const x = WW * ((i + 0.6) / (n + 0.4)) + (Math.random() - 0.5) * W * 0.3;
      const y = H * (a.band[0] + Math.random() * (a.band[1] - a.band[0]));
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      return { id: s.id, x, y, vx: 0, vy: 0, baseX: x, baseY: y, dir, goal: dir, cool: 0, phase: Math.random() * 10, w: Math.min(a.width, W * 0.4) };
    });
    schools.current = SCHOOLS[zoneIndex].map((sc, i) => ({
      x: WW * (0.25 + i * 0.4), y: H * (0.3 + i * 0.25), dir: i % 2 ? -1 : 1, speed: 45 + i * 15, phase: Math.random() * 10, scatter: 0,
      members: Array.from({ length: sc.count }, () => ({ dx: (Math.random() - 0.5) * 160, dy: (Math.random() - 0.5) * 70, ph: Math.random() * 6 })),
    }));
  }, [zone, zoneIndex, view]);

  // ---- scanning ----
  const scan = useCallback(async (id: string) => {
    const sp = zone.species.find((s) => s.id === id);
    if (!sp) return;
    follow.current = null;
    setScanning(id);
    oceanAudio.sfx("scan");
    setTimeout(() => setScanning(null), 900);
    setTimeout(() => setCardId(id), 650);
    try {
      const r = await api.discover(id);
      apply(r, r.gained);
      if (r.gained) oceanAudio.sfx("xp");
      companion.current?.event(`${state.diver.name} ${r.gained ? "just discovered and scanned" : "is checking out"} the ${sp.name} right in front of you. React like you're seeing it together, and share one surprising fact from its card.`);
    } catch { /* card still opens */ }
  }, [zone, apply, state.diver.name]);

  // ---- change zone ----
  const changeZone = useCallback(async (index: number) => {
    const target = zones[index];
    if (!target || busyZone.current) return;
    if (index > maxZone) {
      oceanAudio.sfx("lock");
      toast(`${target.name} is locked`, { description: `Scan 3 creatures in the ${zones[index - 1]?.name ?? zone.name}, then answer its 3-question checkpoint.` });
      return;
    }
    busyZone.current = true;
    const down = index > zoneIndex;
    setTransition(down ? "down" : "up");
    oceanAudio.sfx("dive");
    ocean.current?.bubbles(body.current.x, body.current.y, 40, true);
    try {
      const r = await api.setZone(target.id);
      await new Promise((res) => setTimeout(res, 700));
      apply(r);
      body.current.y = down ? 120 : view.h - 140;
      body.current.vy = down ? 60 : -60;
      setCardId(null);
      companion.current?.event(`You and ${state.diver.name} just ${down ? "descended" : "swam back up"} into the ${target.name} (${target.depthLabel}). React in the moment: how the light, cold and pressure feel, and tease one creature to look for.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => { setTransition(null); busyZone.current = false; }, 600);
    }
  }, [maxZone, zoneIndex, apply, state.diver.name, view.h]);

  // ---- keyboard ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(k)) e.preventDefault();
      keys.current.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) follow.current = null;
      if (k === "e" && nearRef.current) void scan(nearRef.current);
      if (k === " " || k === "enter") {
        const unlocked = nextZone && zoneIndex + 1 <= maxZoneRef.current;
        if (edgeRef.current === "top" && zoneIndex > 0) void changeZone(zoneIndex - 1);
        else if (nearRef.current) void scan(nearRef.current);
        else if (unlocked) void changeZone(zoneIndex + 1);
        else if (nextZone && cpReadyRef.current) setCheckpointOpen(true);
      }
      if (k === "m") companion.current?.toggleMic();
      if (k === "escape") setCardId(null);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [scan, changeZone, nextZone, zoneIndex]);

  // ---- game loop ----
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const b = body.current;
    const cam = camera.current;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      const W = view.w, H = view.h, WW = W * WORLD_SCREENS;

      // --- diver steering (world coords) ---
      let ax = 0, ay = 0;
      const k = keys.current;
      if (k.has("arrowleft") || k.has("a")) ax -= 1;
      if (k.has("arrowright") || k.has("d")) ax += 1;
      if (k.has("arrowup") || k.has("w")) ay -= 1;
      if (k.has("arrowdown") || k.has("s")) ay += 1;
      let goal: { x: number; y: number } | null = pointer.current ? { x: pointer.current.x + cam.x, y: pointer.current.y } : null;
      if (follow.current) {
        const s = swimmers.current.find((w) => w.id === follow.current);
        if (s) {
          goal = { x: s.x - Math.sign(s.x - b.x || 1) * (s.w * 0.42 + DIVER_W * 0.32 + 30), y: s.y }; // just outside its body
          if (Math.hypot(s.x - b.x, s.y - b.y) < s.w * 0.45 + 110) void scan(s.id);
        } else follow.current = null;
      }
      if (goal && !ax && !ay) {
        const dx = goal.x - b.x, dy = goal.y - b.y; const d = Math.hypot(dx, dy);
        if (d > 12) { const f = Math.min(1, d / 160); ax = (dx / d) * f; ay = (dy / d) * f; }
      }
      const thrust = ax || ay ? 950 : 0;
      const mag = Math.hypot(ax, ay) || 1;
      b.vx += (ax / mag) * thrust * dt;
      b.vy += (ay / mag) * thrust * dt;
      const drag = Math.exp(-2.4 * dt); b.vx *= drag; b.vy *= drag;
      const sp = Math.hypot(b.vx, b.vy); if (sp > 340) { b.vx *= 340 / sp; b.vy *= 340 / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(t * 1.1) * 7 * dt; // gentle buoyancy bob
      b.x = Math.max(DIVER_W * 0.72, Math.min(WW - DIVER_W * 0.72, b.x)); // keep the whole 3D diver (fins included) on screen
      b.y = Math.max(125, Math.min(H - 60, b.y)); // stay below the top bar
      if (Math.abs(b.vx) > 25) b.facing = b.vx > 0 ? 1 : -1;

      // --- camera follows, looking a little ahead ---
      const camTarget = Math.max(0, Math.min(WW - W, b.x - W * 0.5 + b.facing * W * 0.12));
      cam.x += (camTarget - cam.x) * (1 - Math.exp(-3.2 * dt));
      if (worldEl.current) worldEl.current.style.transform = `translate3d(${-cam.x}px,0,0)`;
      if (farEl.current) farEl.current.style.transform = `translate3d(${-cam.x * FAR_PARALLAX}px,0,0)`;

      const tilt = Math.max(-28, Math.min(28, (b.vy / 340) * 32));
      if (diverEl.current) {
        diverEl.current.style.transform = `translate(${b.x - DIVER_W / 2}px, ${b.y - DIVER_H / 2}px) scaleX(${b.facing}) rotate(${tilt}deg)`;
        const kick = sp > 60 ? 0.42 : sp > 20 ? 0.8 : 1.5;
        if (kick !== b.kick) { b.kick = kick; diverEl.current.style.setProperty("--kick", `${kick}s`); }
      }
      probe.current.x = b.x - cam.x; probe.current.y = b.y; probe.current.facing = b.facing;
      if (radarDiver.current) radarDiver.current.style.left = `${(b.x / WW) * 100}%`;

      const [d0, d1] = DEPTH_RANGES[zoneIndex] ?? DEPTH_RANGES[0];
      if (depthEl.current) depthEl.current.textContent = `${Math.round(d0 + (b.y / H) * (d1 - d0)).toLocaleString()} m`;

      // --- creatures ---
      let nearest: string | null = null; let best = Infinity;
      for (const s of swimmers.current) {
        const a = speciesArt[s.id];
        if (!a) continue;
        const toDiver = Math.hypot(s.x - b.x, s.y - b.y);
        // Each behaviour picks a target velocity; the animal eases towards it (no instant reversals).
        s.cool = Math.max(0, s.cool - dt);
        const turn = (to: 1 | -1) => { if (s.goal !== to && s.cool <= 0) { s.goal = to; s.cool = 2.2; } };
        let tvx = 0, tvy = 0, ease = 1.2;
        switch (a.behavior) {
          case "cruise":
            if (s.x > s.baseX + W * 0.9 || s.x > WW - s.w) turn(-1);
            if (s.x < s.baseX - W * 0.9 || s.x < s.w) turn(1);
            tvx = s.goal * a.speed;
            tvy = (s.baseY + Math.sin(t * 0.45 + s.phase) * 18 - s.y) * 1.2;
            break;
          case "dart": {
            if (toDiver < 150) turn(s.x > b.x ? 1 : -1); // skittish: flee the diver
            if (s.x > s.baseX + W * 0.6 || s.x > WW - s.w) turn(-1);
            if (s.x < s.baseX - W * 0.6 || s.x < s.w) turn(1);
            const burst = 0.45 + Math.max(0, Math.sin(t * 1.4 + s.phase)) * 1.6;
            tvx = s.goal * a.speed * burst;
            tvy = Math.sin(t * 0.9 + s.phase) * 22;
            if (s.y < H * a.band[0]) tvy = 30; else if (s.y > H * a.band[1]) tvy = -30;
            ease = 2;
            break;
          }
          case "hover":
            tvx = (s.baseX + Math.sin(t * 0.18 + s.phase) * 60 - s.x) * 0.8;
            tvy = (s.baseY + Math.sin(t * 0.55 + s.phase) * 16 - s.y) * 0.8;
            if (Math.abs(b.x - s.x) > 60) turn(b.x > s.x ? 1 : -1); // curious: turns to face the diver
            break;
          case "drift":
            tvx = (s.baseX + Math.sin(t * 0.08 + s.phase) * 140 - s.x) * 0.6;
            tvy = (s.baseY + Math.sin(t * 0.25 + s.phase) * 24 - s.y) * 0.6;
            break;
          case "floor":
            tvx = a.speed ? (s.baseX + Math.sin(t * 0.05 + s.phase) * 60 - s.x) * 0.5 : 0;
            tvy = (H * a.band[0] - s.y) * 2;
            break;
        }
        const k = 1 - Math.exp(-ease * dt);
        s.vx += (tvx - s.vx) * k;
        s.vy += (tvy - s.vy) * k;
        s.x = Math.max(s.w * 0.5, Math.min(WW - s.w * 0.5, s.x + s.vx * dt));
        s.y += s.vy * dt;
        // Facing follows real motion (with a dead zone), or the chosen heading while hovering.
        if (a.behavior === "hover") s.dir = s.goal;
        else if (s.vx > 6) s.dir = 1;
        else if (s.vx < -6) s.dir = -1;
        // Solid bodies: the diver slides around a creature instead of passing through it.
        if (a.behavior !== "floor" || s.w > 120) {
          const rx = s.w * 0.42 + DIVER_W * 0.32, ry = s.w * 0.15 + 30;
          const dx = b.x - s.x, dy = b.y - s.y;
          const e = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (e < 1) {
            // Push out along the shortest way (mostly over or under, like swimming round it).
            const k = e > 1e-4 ? 1 / Math.sqrt(e) : 1;
            b.x = s.x + dx * k; b.y = e > 1e-4 ? s.y + dy * k : s.y - ry; // rest exactly on the edge: no jitter
            const nx = dx / rx, ny = dy / ry, nl = Math.hypot(nx, ny) || 1;
            const into = (b.vx * nx + b.vy * ny) / nl;
            if (into < 0) { b.vx -= (into * nx) / nl; b.vy -= (into * ny) / nl; } // cancel motion into the body
          }
        }
        const el = swimmerEls.current.get(s.id);
        if (el) {
          const onScreen = s.x + s.w > cam.x - 200 && s.x - s.w < cam.x + W + 200;
          el.style.visibility = onScreen ? "visible" : "hidden";
          el.style.transform = `translate(${s.x - s.w / 2}px, ${s.y - s.w * 0.3}px)`;
          (el.firstElementChild as HTMLElement).style.transform = `scaleX(${s.dir})`;
        }
        const dot = radarDots.current.get(s.id);
        if (dot) dot.style.left = `${(s.x / WW) * 100}%`;
        const reach = s.w * 0.45 + 110;
        if (toDiver < reach && toDiver < best) { best = toDiver; nearest = s.id; }
      }
      if (nearest !== nearRef.current) { nearRef.current = nearest; setNear(nearest); }

      // --- fish schools: cruise along, scatter when the diver barges through ---
      schools.current.forEach((sc, si) => {
        sc.x += sc.dir * sc.speed * dt;
        if (sc.x > WW - 100) sc.dir = -1; if (sc.x < 100) sc.dir = 1;
        const dd = Math.hypot(sc.x - b.x, sc.y - b.y);
        sc.scatter = Math.max(0, Math.min(1, sc.scatter + (dd < 170 ? dt * 3 : -dt * 0.6)));
        if (dd < 170) { sc.dir = sc.x > b.x ? 1 : -1; sc.y += (sc.y > b.y ? 1 : -1) * 60 * dt; }
        sc.y = Math.max(H * 0.12, Math.min(H * 0.8, sc.y + Math.sin(t * 0.4 + sc.phase) * 10 * dt));
        sc.members.forEach((m, mi) => {
          const el = schoolEls.current[si]?.[mi];
          if (!el) return;
          const spread = 1 + sc.scatter * 2.2;
          const x = sc.x + m.dx * spread + Math.sin(t * 1.3 + m.ph) * 8;
          const y = sc.y + m.dy * spread + Math.cos(t * 1.7 + m.ph) * 6;
          el.style.transform = `translate(${x}px, ${y}px) scaleX(${sc.dir})`;
        });
      });

      const edgeNow = b.y > H - 120 ? "bottom" : b.y < 110 ? "top" : null;
      if (edgeNow !== edgeRef.current) { edgeRef.current = edgeNow; setEdge(edgeNow); }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scan, view, zoneIndex]);

  const onStagePointer = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const r = stage.current!.getBoundingClientRect();
    pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    follow.current = null;
  };

  const xp = state.xp;
  const foundHere = zone.species.filter((s) => state.discovered.includes(s.id)).length;
  const cpReady = foundHere >= cpNeeded;
  const passedHere = Boolean(state.passedZones?.includes(zone.id));
  const nextUnlocked = nextZone && zoneIndex + 1 <= maxZone;
  // Unlock progress: scanning is 70% of the way, passing the checkpoint is the rest.
  // Path to the next zone: one step per creature scanned (3) plus one for passing the checkpoint.
  const steps = cpNeeded + 1;
  const stepsDone = !nextZone || passedHere ? steps : Math.min(foundHere, cpNeeded);
  // The big next-level banner pops up for a few seconds when it becomes available (or when the diver
  // reaches the bottom), then gets out of the way. The XP chip and Space always open it.
  const promptKey = !nextZone ? "none" : nextUnlocked ? "deeper" : cpReady ? "checkpoint" : "locked";
  const [promptShown, setPromptShown] = useState(false);
  useEffect(() => {
    if (promptKey !== "deeper" && promptKey !== "checkpoint") return;
    setPromptShown(true);
    const t = setTimeout(() => setPromptShown(false), 6000);
    return () => clearTimeout(t);
  }, [promptKey, zone.id]);

  const want3d = (id: string) => webgl2 && (id === "diver" || Boolean(SPECIES_MODEL[id]));
  const hide2d = (id: string) => want3d(id) && (models3d[id] || !loadTimedOut);
  const models3dReady = ["diver", ...zone.species.map((sp) => sp.id)].filter(want3d).every((id) => models3d[id]);
  // Keep the loading screen until the models are in AND their shaders are compiled (no freeze on start).
  const loading3d = webgl2 && !loadTimedOut && !(models3dReady && warmed3d);

  return (
    <main className={`dive zone-${zoneIndex} ${transition ? `transition-${transition}` : ""}`}>
      <div
        ref={stage}
        className="dive-stage"
        onPointerDown={onStagePointer}
        onPointerMove={onStagePointer}
        onPointerUp={() => (pointer.current = null)}
        onPointerLeave={() => (pointer.current = null)}
      >
        <OceanBackdrop ref={ocean} zoneIndex={zoneIndex} diver={probe} camera={camera} waterless={webgl2} />
        {webgl2 ? (
          <Ocean3D key={`${zone.id}-${view.w}x${view.h}`} zoneIndex={zoneIndex} view={view} worldW={worldW} camera={camera} body={body} swimmers={swimmers}
            speciesIds={zone.species.map((s) => s.id)} onModelReady={onModelReady} gear={diverLook(state.diver)} warmReady={models3dReady} onWarm={() => setWarmed3d(true)} />
        ) : (
          <div ref={farEl} className="parallax-far">
            <SeascapeStrip zoneIndex={zoneIndex} layer="far" tiles={Math.ceil(WORLD_SCREENS * FAR_PARALLAX) + 2} tileWidth={view.w} />
          </div>
        )}

        <div ref={worldEl} className="world" style={{ width: worldW }}>
          {!webgl2 && <SeascapeStrip zoneIndex={zoneIndex} layer="near" tiles={WORLD_SCREENS} tileWidth={view.w} />}

          {!webgl2 && SCHOOLS[zoneIndex].map((sc, si) => (
            <div key={`school-${zoneIndex}-${si}`} className="school" aria-hidden="true">
              {Array.from({ length: sc.count }, (_, mi) => (
                <div key={mi} className="school-fish" style={{ width: sc.size }} ref={(el) => { (schoolEls.current[si] ??= [])[mi] = el; }}>
                  <Creature art={sc.art} />
                </div>
              ))}
            </div>
          ))}

          {zone.species.map((s) => {
            const a = speciesArt[s.id];
            const found = state.discovered.includes(s.id);
            return (
              <div
                key={s.id}
                ref={(el) => { if (el) swimmerEls.current.set(s.id, el); else swimmerEls.current.delete(s.id); }}
                className={`swimmer ${near === s.id ? "near" : ""} ${scanning === s.id ? "scanning" : ""} ${found ? "found" : ""} ${hide2d(s.id) ? "has3d" : ""} behavior-${a.behavior}`}
                style={{ width: Math.min(a.width, view.w * 0.4) }}
                onPointerDown={(e) => { e.stopPropagation(); oceanAudio.sfx("click"); if (near === s.id) void scan(s.id); else follow.current = s.id; }}
                role="button"
                aria-label={`Swim to and scan ${s.name}`}
              >
                <div className="swimmer-art"><Creature art={a.art} /></div>
                <span className="swimmer-tag">{near === s.id ? <>{found ? s.name : "Unknown species"} <kbd>E</kbd> scan</> : found ? s.name : "?"}</span>
              </div>
            );
          })}

          <div ref={diverEl} className={`player-diver ${hide2d("diver") ? "has3d" : ""}`} style={{ width: DIVER_W, height: DIVER_H }}>
            <Diver suitHue={state.diver.suitHue} />
          </div>
        </div>
      </div>

      {/* HUD */}
      <header className="hud-top">
        <Link href="/" className="hud-btn" aria-label="Back to base"><Home size={16} /></Link>
        <div className="hud-zone">
          <span className="hud-kicker">LEVEL {zone.level} · {foundHere}/{zone.species.length} FOUND</span>
          <strong>{zone.name}</strong>
        </div>
        <div className="radar" aria-label="Level radar">
          <span className="hud-kicker">RADAR</span>
          <div className="radar-track">
            {zone.species.map((s) => (
              <span key={s.id} ref={(el) => { if (el) radarDots.current.set(s.id, el); else radarDots.current.delete(s.id); }} className={`radar-dot ${state.discovered.includes(s.id) ? "found" : ""}`} title={state.discovered.includes(s.id) ? s.name : "Undiscovered"} />
            ))}
            <span ref={radarDiver} className="radar-me" />
          </div>
        </div>
        <div className="hud-depth"><span className="hud-kicker">DEPTH</span><span ref={depthEl} className="hud-depth-num">0 m</span></div>
        <div className={`hud-xp ${nextZone && (nextUnlocked || cpReady) ? "actionable" : ""}`} role={nextZone && (nextUnlocked || cpReady) ? "button" : undefined} tabIndex={nextZone && (nextUnlocked || cpReady) ? 0 : undefined}
          onClick={() => { if (nextUnlocked) void changeZone(zoneIndex + 1); else if (nextZone && cpReady) setCheckpointOpen(true); }}>
          <div className="hud-xp-row">
            <span className="hud-kicker">{!nextZone ? "DEEPEST ZONE" : passedHere ? `${nextZone.name.toUpperCase()} UNLOCKED` : cpReady ? "CHECKPOINT READY · TAP HERE" : `SCANNED ${foundHere}/${cpNeeded} · THEN THE CHECKPOINT`}</span>
            <b>{xp} XP</b>
          </div>
          <div className="step-bar" aria-label={`${stepsDone} of ${steps} steps to the next zone`}>
            {Array.from({ length: steps }, (_, i) => (
              <span key={i} className={`${i < stepsDone ? "done" : ""} ${i === steps - 1 ? "cp" : ""}`} title={i === steps - 1 ? "Checkpoint" : `Scan ${i + 1}`} />
            ))}
          </div>
        </div>
        <button className="hud-btn" onClick={() => { const m = !muted; setMuted(m); oceanAudio.setMuted(m); }} aria-label={muted ? "Unmute ocean sounds" : "Mute ocean sounds"}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
      </header>

      <ol className="depth-rail" aria-label="Ocean zones">
        {zones.map((z, i) => (
          <li key={z.id} className={`${i === zoneIndex ? "here" : ""} ${i > maxZone ? "locked" : ""}`}>
            <button onClick={() => changeZone(i)} title={`${z.name} · ${z.depthLabel}${i > maxZone ? " · locked: pass the checkpoint above it" : ""}`}><i />{i > maxZone ? <Lock size={10} /> : z.level}</button>
          </li>
        ))}
      </ol>

      {nextZone && !cardId && !checkpointOpen && (promptShown || edge === "bottom") && (
        nextUnlocked ? (
          <button className="edge-prompt bottom" onClick={() => changeZone(zoneIndex + 1)}><ArrowDown size={16} /> Dive deeper into the {nextZone.name} <kbd>Space</kbd></button>
        ) : cpReady ? (
          <button className="edge-prompt bottom checkpoint-ready" onClick={() => setCheckpointOpen(true)}><ShieldCheck size={16} /> Checkpoint: 3 quick questions to unlock the {nextZone.name} <kbd>Space</kbd></button>
        ) : (
          <button className="edge-prompt bottom locked" onClick={() => oceanAudio.sfx("lock")}><Lock size={14} /> Scan {cpNeeded - foundHere} more creature{cpNeeded - foundHere === 1 ? "" : "s"} here to unlock the checkpoint</button>
        )
      )}
      {edge === "top" && zoneIndex > 0 && (
        <button className="edge-prompt top" onClick={() => changeZone(zoneIndex - 1)}><ArrowUp size={16} /> Swim up to the {zones[zoneIndex - 1].name} <kbd>Space</kbd></button>
      )}

      <div className="controls-hint"><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> swim · hold mouse to steer · <kbd>E</kbd> scan · <kbd>M</kbd> talk</div>

      {lineVisible && line.text && (
        <div className="subtitle" style={{ ["--mood" as string]: MOOD_COLORS[line.mood] ?? MOOD_COLORS.curious }} aria-live="polite">
          <span className={`subtitle-orb ${line.speaking ? "speaking" : ""}`} />
          <p><b>{state.diver.companionName}</b>{line.text}</p>
        </div>
      )}
      {line.listening && <div className="listening-pill"><Mic size={14} /> Listening…</div>}

      <div className="transition-veil" aria-hidden="true" />

      <Companion ref={companion} state={state} aiOnline={aiOnline} focusSpeciesId={cardId ?? near ?? undefined} onSnapshot={apply} onLine={onLine}
        onToggleVoice={async (on) => { try { apply(await api.updateDiver({ voiceOn: on })); } catch { /* ignore */ } }} />

      {checkpointOpen && (
        <CheckpointQuiz
          onClose={() => setCheckpointOpen(false)}
          onSnapshot={apply}
          onDiveDeeper={() => void changeZone(zoneIndex + 1)}
          onResult={(r, zoneName) => companion.current?.event(r.passed
            ? `${state.diver.name} just PASSED the ${zoneName} checkpoint with ${r.score}/${r.total}${r.unlocked ? ` and unlocked the ${r.unlocked}` : ""}. Celebrate like a proud friend in one or two lines.`
            : `${state.diver.name} scored ${r.score}/${r.total} on the ${zoneName} checkpoint and needed ${r.passMark}. Encourage them warmly and suggest re-reading the cards they missed.`)}
        />
      )}

      {card && <SpeciesCard species={card} buddy={state.diver.companionName} onClose={() => setCardId(null)}
        onAsk={() => { setCardId(null); companion.current?.ask(`Tell me more about the ${card.name}! How does it survive down here?`); }}
 />}
      {loading3d && (
        <div className="dive-loading" role="status" aria-live="polite">
          <div className="dive-loading-card">
            <span className="eyebrow small">{zone.depthLabel}</span>
            <strong>Diving into the {zone.name}…</strong>
            <div className="dive-loading-bar"><span style={{ width: `${Math.max(8, Math.round(loadProgress))}%` }} /></div>
          </div>
        </div>
      )}
    </main>
  );
}
