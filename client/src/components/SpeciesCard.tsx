import { useEffect } from "react";
import { ArrowUpRight, MessageCircle, X } from "lucide-react";
import type { Species } from "@shared/ocean";
import Creature from "@/components/art/Creature";
import { speciesArt } from "@/components/art/speciesArt";
import SpeciesViewer from "@/three/SpeciesViewer";

/** A creature's card: the live 3D specimen and its facts. Used after a scan and from the collection. */
export default function SpeciesCard({ species, buddy, onClose, onAsk, closeLabel = "Keep swimming" }: { species: Species; buddy?: string; onClose: () => void; onAsk?: () => void; closeLabel?: string }) {
  const a = speciesArt[species.id];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="profile-backdrop" role="presentation" onClick={onClose}>
      <article className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="sp-title" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className={`profile-art ${species.tone}`}><SpeciesViewer speciesId={species.id} className="profile-3d" fallback={<div className="profile-creature"><Creature art={a.art} /></div>} /><span className="art-grid" /></div>
        <div className="profile-copy">
          <div className="eyebrow"><span className="eyebrow-line" />SPECIES CARD · THE CHECKPOINT ASKS ABOUT THIS</div>
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
            {onAsk && buddy && <button className="profile-action" onClick={onAsk}><MessageCircle size={15} /> Ask {buddy}</button>}
            <button className="profile-action ghost" onClick={onClose}>{closeLabel} <ArrowUpRight size={16} /></button>
          </div>
        </div>
      </article>
    </div>
  );
}
