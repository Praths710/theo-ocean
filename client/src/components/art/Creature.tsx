import { useId, type CSSProperties, type ReactNode } from "react";

export type ArtKind =
  | "whale" | "sperm" | "porpoise" | "turtle" | "fish" | "lanternfish" | "swordfish" | "angler"
  | "eel" | "squid" | "vampire" | "siphonophore" | "octopus" | "seapig" | "tripod" | "snailfish" | "shrimp" | "xeno";

export type Art = { kind: ArtKind; body: string; belly?: string; accent?: string; glow?: string };

/** All creatures are drawn facing right. Animated parts use CSS classes from game.css. */
export default function Creature({ art, className, style }: { art: Art; className?: string; style?: CSSProperties }) {
  const uid = useId().replace(/:/g, "");
  const g = (n: string) => `${uid}-${n}`;
  const { body, belly = body, accent = "#0b1a26", glow = "#9ff8ff" } = art;
  const grad = (
    <linearGradient id={g("b")} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={body} />
      <stop offset="1" stopColor={belly} />
    </linearGradient>
  );
  const glowFilter = (
    <filter id={g("glow")} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  );
  const eye = (cx: number, cy: number, r = 2.2, color = "#05080c") => (
    <g><circle cx={cx} cy={cy} r={r} fill={color} /><circle cx={cx + r * 0.35} cy={cy - r * 0.35} r={r * 0.35} fill="#fff" opacity=".8" /></g>
  );

  let content: ReactNode;
  let viewBox = "0 0 200 100";

  switch (art.kind) {
    case "whale":
      viewBox = "0 0 320 110";
      content = (<>
        <g className="tail-v" style={{ transformOrigin: "70px 58px" }}>
          <path d="M72 56 C50 54 30 54 16 56 C6 44 2 36 4 30 C16 38 26 46 34 50 C26 40 22 30 24 24 C36 34 46 46 52 54" fill={body} />
          <path d="M72 58 C50 60 30 60 18 60 C8 70 4 80 6 86 C18 78 28 68 34 64" fill={body} />
        </g>
        <path d="M70 52 C120 30 220 28 290 44 C308 50 314 60 306 68 C280 84 190 88 110 76 C92 72 78 66 70 60 Z" fill={`url(#${g("b")})`} />
        <path d="M150 38 L162 26 L168 38 Z" fill={body} />
        {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${200 + i * 8} ${72 - i * 0.5} C${230 + i * 6} ${76 - i} ${270} ${72 - i} ${298} ${66 - i}`} stroke={accent} strokeOpacity=".25" strokeWidth="1.2" fill="none" />)}
        <g className="flipper" style={{ transformOrigin: "236px 70px" }}><path d="M236 70 C224 84 206 94 196 94 C208 86 220 78 230 68 Z" fill={body} /></g>
        {eye(276, 60, 2.6)}
        <path d="M284 66 C294 66 302 64 308 60" stroke={accent} strokeOpacity=".5" strokeWidth="1.5" fill="none" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={120 + i * 22} cy={48 + (i % 3) * 4} r="2.5" fill="#fff" opacity=".12" />)}
      </>);
      break;

    case "sperm":
      viewBox = "0 0 320 110";
      content = (<>
        <g className="tail-v" style={{ transformOrigin: "70px 58px" }}>
          <path d="M72 56 C50 54 30 52 14 50 C4 40 0 32 4 28 C18 36 30 46 38 52" fill={body} />
          <path d="M72 60 C50 62 30 64 14 68 C4 78 2 86 6 88 C20 80 30 70 38 64" fill={body} />
        </g>
        <path d="M70 54 C110 44 170 38 200 36 L296 34 C310 36 314 48 312 62 C310 74 300 80 286 80 L230 80 C180 82 120 78 96 70 C84 66 74 62 70 58 Z" fill={`url(#${g("b")})`} />
        <path d="M232 80 C250 86 280 86 300 78" stroke={belly} strokeWidth="4" fill="none" />
        <path d="M120 44 C126 40 132 40 138 44" stroke={accent} strokeOpacity=".3" strokeWidth="3" fill="none" />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${100 + i * 20} ${50 + (i % 2) * 6} q6 -3 12 0`} stroke={accent} strokeOpacity=".25" strokeWidth="1.5" fill="none" />)}
        <g className="flipper" style={{ transformOrigin: "220px 74px" }}><path d="M220 74 C212 84 200 90 192 90 C202 82 210 76 216 70 Z" fill={body} /></g>
        {eye(262, 62, 2.2)}
      </>);
      break;

    case "porpoise":
      viewBox = "0 0 220 90";
      content = (<>
        <g className="tail-v" style={{ transformOrigin: "40px 46px" }}>
          <path d="M42 44 C30 42 20 38 10 30 C8 36 12 44 20 46 C12 50 8 58 10 62 C20 54 30 50 42 48 Z" fill={body} />
        </g>
        <path d="M40 44 C70 26 140 22 180 34 C196 40 202 48 198 54 C184 66 120 70 70 60 C54 56 44 52 40 48 Z" fill={`url(#${g("b")})`} />
        <path d="M110 30 C114 20 122 14 130 12 C128 20 128 26 130 32 Z" fill={body} />
        <g className="flipper" style={{ transformOrigin: "150px 58px" }}><path d="M150 58 C142 68 132 72 126 72 C134 64 140 58 146 54 Z" fill={accent} /></g>
        <ellipse cx="178" cy="44" rx="7" ry="5" fill={accent} opacity=".9" />
        {eye(178, 44, 2)}
        <path d="M188 52 C194 52 198 50 200 48" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      </>);
      break;

    case "turtle":
      viewBox = "0 0 200 130";
      content = (<>
        <g className="flipper-back" style={{ transformOrigin: "62px 80px" }}><path d="M62 80 C48 92 36 100 26 102 C34 92 44 84 56 76 Z" fill={belly} /></g>
        <g className="flipper-front" style={{ transformOrigin: "130px 78px" }}><path d="M128 76 C118 98 96 118 74 124 C88 108 104 92 118 72 Z" fill={belly} /></g>
        <ellipse cx="100" cy="66" rx="56" ry="34" fill={`url(#${g("b")})`} />
        <ellipse cx="100" cy="66" rx="56" ry="34" fill="none" stroke={accent} strokeOpacity=".5" strokeWidth="2" />
        {[[80, 56], [104, 50], [126, 58], [92, 74], [116, 76], [70, 72]].map(([x, y], i) => <path key={i} d={`M${x - 10} ${y} l6 -8 h10 l6 8 l-6 8 h-10 Z`} fill={accent} fillOpacity=".22" stroke={accent} strokeOpacity=".45" strokeWidth="1.2" />)}
        <path d="M152 58 C164 50 180 52 186 60 C188 68 180 74 168 72 C160 70 154 66 152 62 Z" fill={belly} />
        <path d="M178 60 L188 62" stroke={accent} strokeWidth="1.5" />
        {eye(172, 58, 2.2)}
        <g className="flipper-front2" style={{ transformOrigin: "132px 54px" }}><path d="M132 54 C124 36 108 20 90 14 C102 28 114 42 122 58 Z" fill={belly} opacity=".85" /></g>
      </>);
      break;

    case "fish":
    case "lanternfish":
    case "snailfish":
      viewBox = "0 0 160 80";
      content = (<>
        <g className="tail-h" style={{ transformOrigin: "40px 40px" }}>
          <path d={art.kind === "snailfish" ? "M44 40 C30 36 16 38 4 44 C16 46 30 46 44 44 Z" : "M44 40 L12 20 C18 32 18 48 12 60 Z"} fill={body} opacity={art.kind === "snailfish" ? 0.7 : 1} />
        </g>
        <path d={art.kind === "snailfish" ? "M40 42 C60 22 110 20 132 34 C142 42 140 52 128 58 C100 66 60 60 40 46 Z" : "M40 40 C60 18 108 16 134 32 C144 38 144 46 134 52 C108 66 60 62 40 40 Z"} fill={`url(#${g("b")})`} opacity={art.kind === "snailfish" ? 0.85 : 1} />
        <path d="M76 22 C84 12 98 10 108 16 L100 24 Z" fill={body} opacity=".8" />
        <path d="M84 56 C90 64 100 66 106 62 L100 54 Z" fill={body} opacity=".7" />
        <path d="M112 30 C108 38 108 46 112 52" stroke={accent} strokeOpacity=".4" strokeWidth="1.5" fill="none" />
        {art.kind === "lanternfish" && (
          <g filter={`url(#${g("glow")})`} className="photophores">
            {[58, 70, 82, 94, 106, 118].map((x, i) => <circle key={x} cx={x} cy={52 - (i % 2)} r="2" fill={glow} />)}
            <circle cx="128" cy="36" r="2.5" fill={glow} />
          </g>
        )}
        {eye(124, 36, art.kind === "lanternfish" ? 5 : 3, art.kind === "snailfish" ? "#1b1020" : "#05080c")}
      </>);
      break;

    case "swordfish":
      viewBox = "0 0 260 90";
      content = (<>
        <g className="tail-h" style={{ transformOrigin: "46px 46px" }}><path d="M50 46 L14 12 C22 30 22 58 14 80 Z" fill={body} /></g>
        <path d="M46 46 C70 26 140 22 180 34 C192 38 196 44 196 46 C196 50 190 54 180 58 C140 70 70 66 46 46 Z" fill={`url(#${g("b")})`} />
        <path d="M192 44 L256 42 L194 49 Z" fill={body} />
        <path d="M100 28 C104 10 112 2 124 0 C120 10 120 20 124 30 Z" fill={body} />
        <g className="flipper" style={{ transformOrigin: "150px 58px" }}><path d="M150 58 C144 70 134 78 126 80 C132 70 138 62 144 56 Z" fill={body} /></g>
        {eye(182, 42, 3.4)}
      </>);
      break;

    case "angler":
      viewBox = "0 0 170 130";
      content = (<>
        <path d="M112 34 C118 14 140 8 150 18" stroke={body} strokeWidth="2.5" fill="none" />
        <g className="lure" filter={`url(#${g("glow")})`}><circle cx="150" cy="20" r="6" fill={glow} /><circle cx="150" cy="20" r="14" fill={glow} opacity=".18" /></g>
        <g className="tail-h" style={{ transformOrigin: "32px 72px" }}><path d="M36 72 L6 54 C10 66 10 80 6 92 Z" fill={body} /></g>
        <path d="M32 72 C36 40 80 30 112 40 C134 48 144 64 140 82 C136 100 110 110 80 108 C52 106 32 96 32 72 Z" fill={`url(#${g("b")})`} />
        <path d="M100 86 C116 96 132 94 140 82 C132 88 116 90 100 86 Z" fill="#05070a" />
        {[104, 112, 120, 128, 134].map((x, i) => <path key={x} d={`M${x} ${88 + (i % 2)} l2 ${-6 - (i % 2) * 2} l2 ${6 + (i % 2) * 2}`} fill="#e9f0f2" />)}
        {[106, 116, 126].map((x) => <path key={x} d={`M${x} 94 l2 5 l2 -5`} fill="#e9f0f2" />)}
        {eye(116, 60, 3.2, "#0a0a0a")}
        <path d="M60 50 C70 46 80 46 90 50" stroke={accent} strokeOpacity=".35" strokeWidth="2" fill="none" />
      </>);
      break;

    case "eel":
      viewBox = "0 0 260 100";
      content = (<>
        <path className="eel-tail" fill="none" stroke={body} strokeWidth="5" strokeLinecap="round">
          <animate attributeName="d" dur="2.4s" repeatCount="indefinite" values="M180 50 C150 40 120 60 90 50 C60 40 30 60 4 50;M180 50 C150 60 120 40 90 50 C60 60 30 40 4 50;M180 50 C150 40 120 60 90 50 C60 40 30 60 4 50" />
        </path>
        <circle cx="6" cy="50" r="3" fill={glow} filter={`url(#${g("glow")})`} className="lure" />
        <path d="M176 44 C196 20 238 18 252 36 C258 44 256 56 248 62 C236 82 196 82 176 58 Z" fill={`url(#${g("b")})`} />
        <path d="M248 46 C230 50 206 54 182 52" stroke="#05070a" strokeWidth="3" fill="none" />
        {eye(244, 36, 2)}
      </>);
      break;

    case "squid":
    case "vampire":
      viewBox = "0 0 240 100";
      content = (<>
        <path d="M150 50 C170 30 210 28 232 40 C238 46 238 54 232 60 C210 72 170 70 150 50 Z" fill={`url(#${g("b")})`} />
        <path d="M216 34 C226 22 236 20 238 28 C236 34 230 38 222 40 Z" fill={body} />
        <path d="M216 66 C226 78 236 80 238 72 C236 66 230 62 222 60 Z" fill={body} />
        {art.kind === "vampire" && <path d="M150 50 C130 30 110 34 96 50 C110 66 130 70 150 50 Z" fill={accent} opacity=".75" />}
        {[-12, -6, 0, 6, 12].map((dy, i) => (
          <path key={i} fill="none" stroke={art.kind === "vampire" ? accent : body} strokeWidth={i === 2 ? 3 : 2.4} strokeLinecap="round">
            <animate attributeName="d" dur={`${1.6 + i * 0.15}s`} repeatCount="indefinite"
              values={`M152 ${50 + dy / 2} C120 ${50 + dy} 90 ${50 + dy * 1.6} ${art.kind === "squid" && i % 2 ? 30 : 60} ${50 + dy * 2};M152 ${50 + dy / 2} C120 ${50 + dy * 1.8} 90 ${50 + dy} ${art.kind === "squid" && i % 2 ? 30 : 60} ${50 + dy * 2.4};M152 ${50 + dy / 2} C120 ${50 + dy} 90 ${50 + dy * 1.6} ${art.kind === "squid" && i % 2 ? 30 : 60} ${50 + dy * 2}`} />
          </path>
        ))}
        {eye(170, 46, art.kind === "squid" ? 6 : 4, art.kind === "vampire" ? "#3fb8ff" : "#0a0a0a")}
        {art.kind === "vampire" && <circle cx="170" cy="46" r="9" fill="#3fb8ff" opacity=".2" filter={`url(#${g("glow")})`} className="lure" />}
      </>);
      break;

    case "siphonophore":
      viewBox = "0 0 90 300";
      content = (<>
        <g filter={`url(#${g("glow")})`}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <ellipse key={i} cx={45 + Math.sin(i) * 4} cy={20 + i * 22} rx={14 - i * 0.8} ry="10" fill={glow} opacity={0.35 - i * 0.02} className="jelly-pulse" style={{ animationDelay: `${i * 0.18}s` }} />)}
        </g>
        {[30, 40, 50, 60].map((x, i) => (
          <path key={x} fill="none" stroke={glow} strokeOpacity=".35" strokeWidth="1">
            <animate attributeName="d" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" values={`M${x} 190 C${x - 10} 230 ${x + 10} 260 ${x} 298;M${x} 190 C${x + 10} 230 ${x - 10} 260 ${x} 298;M${x} 190 C${x - 10} 230 ${x + 10} 260 ${x} 298`} />
          </path>
        ))}
      </>);
      break;

    case "octopus":
      viewBox = "0 0 160 150";
      content = (<>
        <g className="ear ear-l" style={{ transformOrigin: "52px 52px" }}><path d="M52 52 C34 34 22 36 18 46 C26 52 38 56 52 58 Z" fill={body} opacity=".9" /></g>
        <g className="ear ear-r" style={{ transformOrigin: "108px 52px" }}><path d="M108 52 C126 34 138 36 142 46 C134 52 122 56 108 58 Z" fill={body} opacity=".9" /></g>
        <path d="M40 70 C40 30 120 30 120 70 C120 86 104 96 80 96 C56 96 40 86 40 70 Z" fill={`url(#${g("b")})`} />
        <g className="skirt">
          <path d="M44 84 C40 110 50 128 46 144 C60 130 70 116 80 100 C90 116 100 130 114 144 C110 128 120 110 116 84 Z" fill={body} opacity=".85" />
        </g>
        {eye(66, 70, 4)}{eye(94, 70, 4)}
      </>);
      break;

    case "seapig":
      viewBox = "0 0 180 100";
      content = (<>
        <path d="M20 60 C20 36 60 28 100 30 C140 32 166 44 166 62 C166 76 140 82 96 82 C52 82 20 78 20 60 Z" fill={`url(#${g("b")})`} opacity=".9" />
        <path d="M130 34 C134 18 138 10 144 8 M142 38 C150 24 156 18 162 18" stroke={body} strokeWidth="4" strokeLinecap="round" fill="none" className="antenna" />
        {[34, 56, 78, 100, 122, 144].map((x, i) => (
          <g key={x} className="tube-foot" style={{ transformOrigin: `${x}px 80px`, animationDelay: `${i * 0.2}s` }}>
            <path d={`M${x} 78 C${x - 2} 88 ${x - 4} 94 ${x - 6} 98`} stroke={belly} strokeWidth="6" strokeLinecap="round" fill="none" />
          </g>
        ))}
        {eye(150, 52, 1.8)}
      </>);
      break;

    case "tripod":
      viewBox = "0 0 180 150";
      content = (<>
        <path d="M40 50 L4 34 C8 44 8 56 4 66 Z" fill={body} />
        <path d="M36 50 C56 34 110 32 140 42 C150 46 150 56 140 60 C110 70 56 66 36 50 Z" fill={`url(#${g("b")})`} />
        <path d="M60 60 C56 90 50 120 44 146 M68 60 C72 90 78 120 84 146 M52 44 C48 80 30 112 16 146" stroke={body} strokeWidth="1.8" fill="none" opacity=".85" />
        <path d="M120 36 C132 22 150 18 170 20 M122 38 C136 30 152 30 172 34" stroke={body} strokeWidth="1.2" fill="none" opacity=".7" />
        {eye(136, 48, 1.8)}
      </>);
      break;

    case "shrimp":
      viewBox = "0 0 140 90";
      content = (<>
        <path d="M20 60 C24 30 70 20 104 34 C118 40 124 52 116 62 C100 70 60 72 40 66 C30 64 22 64 20 60 Z" fill={`url(#${g("b")})`} />
        {[40, 56, 72, 88].map((x) => <path key={x} d={`M${x} 28 C${x + 4} 44 ${x + 4} 58 ${x} 70`} stroke={accent} strokeOpacity=".4" strokeWidth="1.5" fill="none" />)}
        <path d="M20 60 L4 50 L8 64 L2 74 Z" fill={body} />
        {[46, 60, 74, 88, 100].map((x, i) => <path key={x} className="shrimp-leg" style={{ transformOrigin: `${x}px 66px`, animationDelay: `${i * 0.08}s` }} d={`M${x} 66 l-4 14`} stroke={body} strokeWidth="2" strokeLinecap="round" />)}
        <path d="M112 38 C124 20 132 10 138 4 M116 42 C128 34 136 32 140 32" stroke={body} strokeWidth="1.2" fill="none" />
        {eye(110, 42, 2.4)}
      </>);
      break;

    case "xeno":
      viewBox = "0 0 160 110";
      content = (<>
        <g filter={`url(#${g("glow")})`} className="xeno-glow">
          <path d="M20 104 C18 70 34 46 54 50 C60 30 84 22 100 36 C116 26 140 40 136 64 C150 76 146 100 140 104 Z" fill={`url(#${g("b")})`} />
          {[[48, 72], [70, 58], [96, 52], [118, 68], [84, 84], [60, 90], [112, 90]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4 + (i % 3)} fill="none" stroke={glow} strokeOpacity=".5" strokeWidth="1.5" />)}
        </g>
      </>);
      break;
  }

  return (
    <svg viewBox={viewBox} className={`creature-svg kind-${art.kind} ${className ?? ""}`} style={style} aria-hidden="true">
      <defs>{grad}{glowFilter}</defs>
      {content}
    </svg>
  );
}
