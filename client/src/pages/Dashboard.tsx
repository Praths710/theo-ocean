import { useEffect, useState } from "react";
import { Award, Brain, Check, Fish, Gem, Info, Lock, LogOut, Play, RotateCcw, Shirt, Shuffle, Star, Target, Trophy, X } from "lucide-react";
import Credits from "@/components/Credits";
import SpeciesCard from "@/components/SpeciesCard";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { DIVER_PRESETS, GEAR_SWATCHES, diverLook, rankFor, zones, type DiverLook } from "@shared/ocean";
import OceanBackdrop from "@/components/ocean/OceanBackdrop";
import Backdrop3D from "@/three/Backdrop3D";
import { SPECIES_MODEL, type ModelId } from "@/three/modelConfig";
import DiverStage from "@/three/DiverStage";
import ModelThumb from "@/three/ModelThumb";
import Creature from "@/components/art/Creature";
import { speciesArt } from "@/components/art/speciesArt";
import { MOOD_COLORS } from "@/components/Companion";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { oceanAudio } from "@/lib/oceanAudio";

const RARITY: Record<string, { label: string; cls: string }> = {
  "Critically endangered": { label: "LEGENDARY", cls: "legendary" },
  Endangered: { label: "EPIC", cls: "epic" },
  Vulnerable: { label: "RARE", cls: "rare" },
};
const ZONE_ICON = ["hawksbill", "lanternfish", "anglerfish", "dumbo-octopus", "snailfish"];

export default function Dashboard() {
  const { user, snap, apply, logout, aiOnline } = useSession();
  const [, navigate] = useLocation();
  const [locker, setLocker] = useState(false);
  const [credits, setCredits] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const state = snap!.state;
  const maxZone = snap!.maxZoneIndex;
  const zoneIdx = Math.max(0, zones.findIndex((z) => z.id === state.zoneId));
  const zone = zones[zoneIdx];
  const allSpecies = zones.flatMap((z) => z.species.map((s) => ({ ...s, zone: z })));
  const found = state.discovered.length;
  const rank = rankFor(state.xp);
  const sunlitFound = zones[0].species.filter((s) => state.discovered.includes(s.id)).length;

  const badges = [
    { id: "first", name: "First Contact", desc: "Scan your first species", icon: Fish, got: found >= 1 },
    { id: "reef", name: "Reef Friend", desc: "Scan every Sunlit Reef species", icon: Star, got: sunlitFound === zones[0].species.length },
    { id: "quiz", name: "Quiz Whiz", desc: "Pass 2 zone checkpoints", icon: Brain, got: (state.passedZones?.length ?? 0) >= 2 },
    { id: "twilight", name: "Into the Dark", desc: "Unlock the Twilight Zone", icon: Target, got: maxZone >= 1 },
    { id: "midnight", name: "Midnight Voyager", desc: "Unlock the Midnight Zone", icon: Award, got: maxZone >= 2 },
    { id: "collector", name: "Collector", desc: "Scan 10 species", icon: Gem, got: found >= 10 },
    { id: "abyss", name: "Abyss Walker", desc: "Unlock the Abyssal Plain", icon: Trophy, got: maxZone >= 3 },
    { id: "legend", name: "Trench Legend", desc: "Unlock the Hadal Trench", icon: Trophy, got: maxZone >= 4 },
  ];
  const missions = [
    { name: "Scan your first creature", cur: Math.min(found, 1), max: 1, xp: 25 },
    { name: `Complete the Sunlit Reef logbook`, cur: sunlitFound, max: zones[0].species.length, xp: 100 },
    { name: "Pass 2 zone checkpoints", cur: Math.min(state.passedZones?.length ?? 0, 2), max: 2, xp: 200 }, // labels = the XP those actions really earn
    { name: `Pass the ${zones[maxZone].name} checkpoint`, cur: state.passedZones?.includes(zones[maxZone].id) ? 1 : 0, max: 1, xp: 100 },
    { name: "Scan 10 species", cur: Math.min(found, 10), max: 10, xp: 250 },
  ].filter((m) => m.cur < m.max).slice(0, 3);

  const buddyLine = state.learner.summary === "New diver. Nothing known yet."
    ? `Hey ${state.diver.name}! I'm ${state.diver.companionName}, your dive buddy. Jump in and let's find something amazing!`
    : `${state.learner.summary}`;

  const dive = async (index = zoneIdx) => {
    oceanAudio.start();
    oceanAudio.sfx("dive");
    if (index !== zoneIdx) {
      try { apply(await api.setZone(zones[index].id)); } catch (e) { toast.error((e as Error).message); return; }
    }
    navigate("/dive");
  };

  return (
    <main className="base">
      <div className="base-bg" aria-hidden="true">
        <OceanBackdrop zoneIndex={zoneIdx} waterless />
        <Backdrop3D className="backdrop-3d" zoneIndex={zoneIdx}
          cruisers={zones[zoneIdx].species.filter((s) => SPECIES_MODEL[s.id]).slice(0, 2).map((s, i) => ({ id: SPECIES_MODEL[s.id] as ModelId, y: -2.2 - i * 1.6, z: -3 - i * 3, length: 1.6, speed: 0.9 + i * 0.3, phase: i * 0.7 }))} />
        <div className="base-shade" />
      </div>

      {/* ---------- top HUD ---------- */}
      <header className="base-top">
        <div className="player-badge">
          <div className="player-portrait" style={{ ["--suit" as string]: diverLook(state.diver).suit }}>{state.diver.name.slice(0, 1).toUpperCase()}</div>
          <div className="player-info">
            <strong>{state.diver.name}</strong>
            <div className="lvl-row" title={rank.next ? `${rank.next.xp - state.xp} XP to ${rank.next.name}` : "Top rank"}>
              <span className="lvl">{rank.name}</span><div className="lvl-bar"><span style={{ width: `${rank.pct}%` }} /></div>
            </div>
          </div>
        </div>
        <div className="currencies">
          <span className="coin xp" title="XP: 25 per new species scanned, 100 per checkpoint passed"><Gem size={15} /><b>{state.xp}</b><small>XP</small></span>
          <span className="coin shells" title="Species discovered"><Fish size={15} /><b>{found}/{allSpecies.length}</b><small>species</small></span>
          <span className="coin stars" title="Zone checkpoints passed"><Star size={15} /><b>{state.passedZones?.length ?? 0}/{zones.length}</b><small>checkpoints</small></span>
          <span className="coin trophies" title="Badges earned"><Trophy size={15} /><b>{badges.filter((b) => b.got).length}/{badges.length}</b><small>badges</small></span>
        </div>
        <div className="top-buttons">
          <button className="round-btn" onClick={() => setCredits(true)} aria-label="Credits" title="Credits"><Info size={17} /></button>
          <button className="round-btn" onClick={() => setLocker(true)} aria-label="Customize diver" title="Customize diver"><Shirt size={17} /></button>
          <button className="round-btn" onClick={() => logout()} aria-label="Log out" title={`Log out ${user!.username}`}><LogOut size={17} /></button>
        </div>
      </header>

      <section className="base-main">
        {/* ---------- expedition map ---------- */}
        <aside className="card-panel expedition">
          <h2 className="panel-title"><Target size={16} /> EXPEDITIONS</h2>
          <ol className="level-path">
            {zones.map((z, i) => {
              const locked = i > maxZone;
              const got = z.species.filter((s) => state.discovered.includes(s.id)).length;
              return (
                <li key={z.id} className={`level-node ${locked ? "locked" : ""} ${i === zoneIdx ? "current" : ""}`} style={{ ["--i" as string]: i }}>
                  <button disabled={locked} onClick={() => dive(i)} className="node-orb" style={{ ["--zc" as string]: ["#3fb6d6", "#2a6f9e", "#3a3f8f", "#4a2f6b", "#5a1f3a"][i] }} aria-label={locked ? `${z.name}, locked until you pass the ${zones[i - 1].name} checkpoint` : `Dive into ${z.name}`}>
                    {locked ? <Lock size={18} /> : <span className="node-creature"><ModelThumb speciesId={ZONE_ICON[i]} className="thumb-img" fallback={<Creature art={speciesArt[ZONE_ICON[i]].art} />} /></span>}
                    <span className="node-num">{z.level}</span>
                  </button>
                  <div className="node-text">
                    <strong>{z.name}</strong>
                    <span>{locked ? `Locked · pass level ${i}` : state.passedZones?.includes(z.id) ? `${z.depthLabel} · ✓ passed` : z.depthLabel}</span>
                    {!locked && <span className="pips">{z.species.map((s) => <i key={s.id} className={state.discovered.includes(s.id) ? "on" : ""} />)}<em>{got}/{z.species.length}</em></span>}
                  </div>
                  {i === zoneIdx && <span className="you-are-here">YOU</span>}
                </li>
              );
            })}
          </ol>
        </aside>

        {/* ---------- hero stage ---------- */}
        <div className="stage-center">
          <p className="stage-kicker">LEVEL {zone.level} · {zone.depthLabel}</p>
          <h1 className="stage-title">{zone.name}</h1>
          <div className="stage-diver">
            <div className="spotlight" />
            <DiverStage className="stage-diver-3d" look={diverLook(state.diver)} />
            {[0, 1, 2, 3, 4].map((i) => <i key={i} className="stage-bubble" style={{ left: `${58 + i * 3}%`, animationDelay: `${i * 0.7}s` }} />)}
          </div>
          <div className="buddy-bubble" style={{ ["--mood" as string]: MOOD_COLORS.curious }}>
            <span className={`buddy-orb ${aiOnline ? "" : "off"}`} />
            <div>
              <b>{state.diver.companionName.toUpperCase()}{aiOnline ? "" : " · OFFLINE"}</b>
              <p>{buddyLine}</p>
              {state.learner.interests.length > 0 && <div className="chip-row">{state.learner.interests.slice(0, 4).map((i) => <span key={i} className="chip">{i}</span>)}</div>}
            </div>
          </div>
          <button className="play-btn" onClick={() => dive()}>
            <Play size={26} fill="currentColor" />
            <span><b>DIVE IN</b><small>{zone.name}</small></span>
          </button>
        </div>

        {/* ---------- missions + badges ---------- */}
        <aside className="side-stack">
          <div className="card-panel">
            <h2 className="panel-title"><Check size={16} /> MISSIONS</h2>
            {missions.length === 0 ? <p className="muted">All missions complete. You're a legend!</p> : (
              <ul className="missions">
                {missions.map((m) => (
                  <li key={m.name}>
                    <div className="mission-head"><span>{m.name}</span>{m.xp > 0 && <em>+{m.xp} XP</em>}</div>
                    <div className="mission-bar"><span style={{ width: `${(m.cur / m.max) * 100}%` }} /></div>
                    <small>{m.cur} / {m.max}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card-panel">
            <h2 className="panel-title"><Award size={16} /> BADGES</h2>
            <div className="badges">
              {badges.map((b) => (
                <div key={b.id} className={`badge ${b.got ? "got" : ""}`} title={`${b.name}: ${b.desc}`}>
                  <span className="badge-medal"><b.icon size={18} /></span>
                  <span className="badge-name">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* ---------- collection ---------- */}
      <section className="collection">
        <h2 className="panel-title"><Fish size={16} /> COLLECTION <span className="muted">· {found} of {allSpecies.length}</span></h2>
        <div className="card-rail">
          {allSpecies.map((s) => {
            const got = state.discovered.includes(s.id);
            const rarity = RARITY[s.status] ?? { label: "COMMON", cls: "common" };
            return (
              <article key={s.id} className={`species-card ${rarity.cls} ${got ? "got" : "mystery"}`} role={got ? "button" : undefined} tabIndex={got ? 0 : undefined} onClick={() => got && setViewing(s.id)} onKeyDown={(e) => got && e.key === "Enter" && setViewing(s.id)} aria-label={got ? `Open the ${s.name} card` : undefined}>
                <span className="rarity">{got ? rarity.label : "???"}</span>
                <div className="sc-art"><ModelThumb speciesId={s.id} className="thumb-img" alt={got ? s.name : ""} fallback={<Creature art={speciesArt[s.id].art} />} /></div>
                <strong>{got ? s.name : "Undiscovered"}</strong>
                <small>{got ? s.status : `Somewhere in the ${s.zone.name}`}</small>
                {got && <span className="shine" />}
              </article>
            );
          })}
        </div>
      </section>

      {locker && <Locker onClose={() => setLocker(false)} />}
      {credits && <Credits onClose={() => setCredits(false)} />}
      {viewing && (() => { const sp = allSpecies.find((x) => x.id === viewing); return sp ? <SpeciesCard species={sp} onClose={() => setViewing(null)} closeLabel="Back to base" /> : null; })()}
    </main>
  );
}

const GEAR_PARTS: { key: keyof DiverLook; label: string }[] = [
  { key: "suit", label: "Wetsuit" }, { key: "panel", label: "Side panels" }, { key: "fins", label: "Fins" }, { key: "tank", label: "Tank" },
];

function Locker({ onClose }: { onClose: () => void }) {
  const { snap, apply } = useSession();
  const state = snap!.state;
  const [diverName, setDiverName] = useState(state.diver.name);
  const [buddyName, setBuddyName] = useState(state.diver.companionName);
  const [look, setLook] = useState<DiverLook>(() => diverLook(state.diver));
  const [part, setPart] = useState<keyof DiverLook>("suit");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const preset = DIVER_PRESETS.find((p) => GEAR_PARTS.every(({ key }) => p.look[key] === look[key]));
  const save = async () => {
    setSaving(true);
    try { apply(await api.updateDiver({ name: diverName, companionName: buddyName, look })); toast.success("Looking sharp!"); onClose(); } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };
  const shuffle = () => {
    const pick = () => GEAR_SWATCHES[Math.floor(Math.random() * GEAR_SWATCHES.length)];
    setLook({ suit: pick(), panel: pick(), fins: pick(), tank: pick() });
  };
  return (
    <div className="profile-backdrop" role="presentation" onClick={onClose}>
      <article className="locker-modal" role="dialog" aria-modal="true" aria-labelledby="locker-title" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="locker-stage">
          <div className="spotlight" />
          <DiverStage className="stage-diver-3d" look={look} length={2.6} />
          <p className="locker-outfit-name">{preset ? preset.name : "Custom outfit"}</p>
        </div>
        <div className="locker-form">
          <h2 id="locker-title">Diver locker</h2>
          <div className="locker-names">
            <label className="field"><span>DIVER NAME</span><input value={diverName} maxLength={24} onChange={(e) => setDiverName(e.target.value)} /></label>
            <label className="field"><span>BUDDY NAME</span><input value={buddyName} maxLength={24} onChange={(e) => setBuddyName(e.target.value)} /></label>
          </div>
          <div className="field"><span>OUTFITS</span>
            <div className="preset-grid">
              {DIVER_PRESETS.map((p) => (
                <button key={p.id} className={`preset ${preset?.id === p.id ? "active" : ""}`} onClick={() => setLook(p.look)} aria-pressed={preset?.id === p.id}>
                  <span className="preset-chips">{GEAR_PARTS.map(({ key }) => <i key={key} style={{ background: p.look[key] }} />)}</span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><span>CUSTOMIZE</span>
            <div className="part-tabs" role="tablist">
              {GEAR_PARTS.map(({ key, label }) => (
                <button key={key} role="tab" aria-selected={part === key} className={part === key ? "active" : ""} onClick={() => setPart(key)}>
                  <i style={{ background: look[key] }} />{label}
                </button>
              ))}
            </div>
            <div className="swatch-grid" role="radiogroup" aria-label={`${GEAR_PARTS.find((g) => g.key === part)!.label} colour`}>
              {GEAR_SWATCHES.map((c) => (
                <button key={c} role="radio" aria-checked={look[part] === c} aria-label={c} className={look[part] === c ? "active" : ""} style={{ background: c }} onClick={() => setLook((l) => ({ ...l, [part]: c }))} />
              ))}
            </div>
          </div>
          <div className="custom-actions">
            <button className="play-btn small" onClick={save} disabled={saving}>{saving ? "SAVING…" : "SAVE"}</button>
            <button className="reset-link" onClick={shuffle}><Shuffle size={12} /> Surprise me</button>
            <button className="reset-link" onClick={async () => { if (confirm("Reset all progress, XP and what your buddy has learned about you?")) { apply(await api.reset()); toast("Progress reset."); onClose(); } }}><RotateCcw size={12} /> Reset progress</button>
          </div>
        </div>
      </article>
    </div>
  );
}
