import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Brain, Home, Lock, MessageCircle, Mic, Volume2, VolumeX, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { zones, type Species } from "@shared/ocean";
import OceanBackdrop, { type DiverProbe, type OceanHandle } from "@/components/ocean/OceanBackdrop";
import { SeascapeStrip } from "@/components/ocean/Seascape";
import Diver from "@/components/art/Diver";
import Creature, { type Art } from "@/components/art/Creature";
import { speciesArt } from "@/components/art/speciesArt";
import Companion, { MOOD_COLORS, type CompanionHandle } from "@/components/Companion";
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

type Swimmer = { id: string; x: number; y: number; baseX: number; baseY: number; dir: 1 | -1; phase: number; w: number };
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
  const [scanning, setScanning] = useState<string | null>(null);
  const [transition, setTransition] = useState<"down" | "up" | null>(null);
  const [muted, setMuted] = useState(oceanAudio.isMuted());
  const [line, setLine] = useState({ text: "", mood: "curious", speaking: false, listening: false, thinking: false });
  const [lineVisible, setLineVisible] = useState(false);
  const nearRef = useRef<string | null>(null);
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
      return { id: s.id, x, y, baseX: x, baseY: y, dir: Math.random() < 0.5 ? 1 : -1, phase: Math.random() * 10, w: Math.min(a.width, W * 0.4) };
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
      toast(`${target.name} is locked`, { description: `Reach ${target.xpRequired} XP. Scan creatures and ace quizzes!` });
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
        if (edgeRef.current === "bottom" && nextZone) void changeZone(zoneIndex + 1);
        else if (edgeRef.current === "top" && zoneIndex > 0) void changeZone(zoneIndex - 1);
        else if (nearRef.current) void scan(nearRef.current);
      }
      if (k === "q") companion.current?.quiz();
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
          goal = { x: s.x - Math.sign(s.x - b.x || 1) * (s.w * 0.45 + 70), y: s.y };
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
      b.x = Math.max(DIVER_W * 0.4, Math.min(WW - DIVER_W * 0.4, b.x));
      b.y = Math.max(70, Math.min(H - 60, b.y));
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
        switch (a.behavior) {
          case "cruise":
            s.x += s.dir * a.speed * dt;
            s.y = s.baseY + Math.sin(t * 0.45 + s.phase) * 18;
            if (s.x > s.baseX + W * 0.9) s.dir = -1;
            if (s.x < s.baseX - W * 0.9) s.dir = 1;
            s.x = Math.max(s.w * 0.5, Math.min(WW - s.w * 0.5, s.x));
            if (s.x <= s.w * 0.5) s.dir = 1; if (s.x >= WW - s.w * 0.5) s.dir = -1;
            break;
          case "dart": {
            const burst = 0.35 + Math.max(0, Math.sin(t * 1.4 + s.phase)) * 1.8;
            if (toDiver < 130) s.dir = s.x > b.x ? 1 : -1; // skittish: flee the diver
            s.x += s.dir * a.speed * burst * dt;
            s.y += Math.sin(t * 0.9 + s.phase) * 22 * dt;
            s.y = Math.max(H * a.band[0], Math.min(H * a.band[1], s.y));
            if (s.x > s.baseX + W * 0.6) s.dir = -1; if (s.x < s.baseX - W * 0.6) s.dir = 1;
            break;
          }
          case "hover":
            s.x = s.baseX + Math.sin(t * 0.18 + s.phase) * 60;
            s.y = s.baseY + Math.sin(t * 0.55 + s.phase) * 16;
            s.dir = b.x > s.x ? 1 : -1; // curious: faces the diver
            break;
          case "drift":
            s.x = s.baseX + Math.sin(t * 0.08 + s.phase) * 140;
            s.y = s.baseY + Math.sin(t * 0.25 + s.phase) * 24;
            s.dir = Math.cos(t * 0.08 + s.phase) > 0 ? 1 : -1;
            break;
          case "floor":
            s.x = s.baseX + (a.speed ? Math.sin(t * 0.05 + s.phase) * 60 : 0);
            s.y = H * a.band[0];
            break;
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
  const xpPct = nextZone ? Math.min(100, Math.max(0, ((xp - zone.xpRequired) / (nextZone.xpRequired - zone.xpRequired)) * 100)) : 100;
  const foundHere = zone.species.filter((s) => state.discovered.includes(s.id)).length;
  const nextUnlocked = nextZone && zoneIndex + 1 <= maxZone;

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
        <OceanBackdrop ref={ocean} zoneIndex={zoneIndex} diver={probe} camera={camera} />
        <div ref={farEl} className="parallax-far">
          <SeascapeStrip zoneIndex={zoneIndex} layer="far" tiles={Math.ceil(WORLD_SCREENS * FAR_PARALLAX) + 2} tileWidth={view.w} />
        </div>

        <div ref={worldEl} className="world" style={{ width: worldW }}>
          <SeascapeStrip zoneIndex={zoneIndex} layer="near" tiles={WORLD_SCREENS} tileWidth={view.w} />

          {SCHOOLS[zoneIndex].map((sc, si) => (
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
                className={`swimmer ${near === s.id ? "near" : ""} ${scanning === s.id ? "scanning" : ""} ${found ? "found" : ""} behavior-${a.behavior}`}
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

          <div ref={diverEl} className="player-diver" style={{ width: DIVER_W, height: DIVER_H }}>
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
        <div className="hud-xp">
          <div className="hud-xp-row"><span className="hud-kicker">{nextZone ? `NEXT: ${nextZone.name.toUpperCase()}` : "MAX DEPTH"}</span><b>{xp} XP</b></div>
          <div className="xp-bar"><span style={{ width: `${xpPct}%` }} /></div>
        </div>
        <button className="hud-btn" onClick={() => { const m = !muted; setMuted(m); oceanAudio.setMuted(m); }} aria-label={muted ? "Unmute ocean sounds" : "Mute ocean sounds"}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
      </header>

      <ol className="depth-rail" aria-label="Ocean zones">
        {zones.map((z, i) => (
          <li key={z.id} className={`${i === zoneIndex ? "here" : ""} ${i > maxZone ? "locked" : ""}`}>
            <button onClick={() => changeZone(i)} title={`${z.name} · ${z.depthLabel}${i > maxZone ? ` · ${z.xpRequired} XP` : ""}`}><i />{i > maxZone ? <Lock size={10} /> : z.level}</button>
          </li>
        ))}
      </ol>

      {edge === "bottom" && nextZone && (
        <button className={`edge-prompt bottom ${nextUnlocked ? "" : "locked"}`} onClick={() => changeZone(zoneIndex + 1)}>
          {nextUnlocked ? <><ArrowDown size={16} /> Dive deeper into the {nextZone.name} <kbd>Space</kbd></> : <><Lock size={14} /> {nextZone.name} unlocks at {nextZone.xpRequired} XP</>}
        </button>
      )}
      {edge === "top" && zoneIndex > 0 && (
        <button className="edge-prompt top" onClick={() => changeZone(zoneIndex - 1)}><ArrowUp size={16} /> Swim up to the {zones[zoneIndex - 1].name} <kbd>Space</kbd></button>
      )}

      <div className="controls-hint"><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> swim · hold mouse to steer · <kbd>E</kbd> scan · <kbd>Q</kbd> quiz · <kbd>M</kbd> talk</div>

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

      {card && <SpeciesCard species={card} buddy={state.diver.companionName} onClose={() => setCardId(null)}
        onAsk={() => { setCardId(null); companion.current?.ask(`Tell me more about the ${card.name}! How does it survive down here?`); }}
        onQuiz={() => { setCardId(null); companion.current?.quiz(card.id); }} />}
    </main>
  );
}

function SpeciesCard({ species, buddy, onClose, onAsk, onQuiz }: { species: Species; buddy: string; onClose: () => void; onAsk: () => void; onQuiz: () => void }) {
  const a = speciesArt[species.id];
  return (
    <div className="profile-backdrop" role="presentation" onClick={onClose}>
      <article className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="sp-title" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className={`profile-art ${species.tone}`}><div className="profile-creature"><Creature art={a.art} /></div><span className="art-grid" /></div>
        <div className="profile-copy">
          <div className="eyebrow"><span className="eyebrow-line" />SCAN COMPLETE · QUIZ MATERIAL</div>
          <h2 id="sp-title">{species.name}</h2>
          <p className="profile-scientific">{species.scientific}</p>
          <span className="status-chip">{species.status}</span>
          <p className="profile-details">{species.fact} {species.details}</p>
          <div className="profile-facts">
            <div><span>HABITAT</span><strong>{species.habitat}</strong></div>
            <div><span>THREATS</span><strong>{species.threats}</strong></div>
            <div><span>WHAT HELPS</span><strong>{species.action}</strong></div>
          </div>
          <div className="profile-buttons">
            <button className="profile-action" onClick={onAsk}><MessageCircle size={15} /> Ask {buddy}</button>
            <button className="profile-action" onClick={onQuiz}><Brain size={15} /> Quiz me on this</button>
            <button className="profile-action ghost" onClick={onClose}>Keep swimming <ArrowUpRight size={16} /></button>
          </div>
        </div>
      </article>
    </div>
  );
}
