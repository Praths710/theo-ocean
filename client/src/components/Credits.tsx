import { useEffect } from "react";
import { X } from "lucide-react";
import { MODEL_CONFIG, SPECIES_MODEL, type ModelId } from "@/three/modelConfig";

/** Attribution for the 3D models (required by their Creative Commons Attribution licence). */
export default function Credits({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const used: ModelId[] = Array.from(new Set<ModelId>(["diver", "coral-reef", "rocks", ...(Object.values(SPECIES_MODEL) as ModelId[])]));
  return (
    <div className="profile-backdrop" role="presentation" onClick={onClose}>
      <article className="checkpoint credits" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <header className="cp-head"><div><span className="eyebrow small">THANK YOU</span><h2 id="credits-title">3D model credits</h2></div></header>
        <div className="cp-body">
          <p className="muted">These 3D models are used under Creative Commons Attribution licences. They were optimised and re-posed for this game.</p>
          <ul className="credit-list">
            {used.filter((id) => MODEL_CONFIG[id].credit.url).map((id) => {
              const c = MODEL_CONFIG[id].credit;
              return (
                <li key={id}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>
                  <span>by {c.author} · {c.license ?? "CC Attribution"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </article>
    </div>
  );
}
