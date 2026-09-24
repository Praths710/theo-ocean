import { useId, type CSSProperties, type ReactNode } from "react";

export type ArtKind =
  | "whale" | "sperm" | "porpoise" | "turtle" | "greenturtle" | "fish" | "lanternfish" | "swordfish" | "angler"
  | "eel" | "squid" | "vampire" | "siphonophore" | "octopus" | "seapig" | "tripod" | "snailfish" | "shrimp" | "xeno";

export type Art = { kind: ArtKind; body: string; belly?: string; accent?: string; glow?: string };

/**
 * Anatomically detailed side-view marine life, drawn facing right. Realism comes from
 * countershading (dark back, pale belly), top-down light, specular highlights, skin grain
 * and mottling (SVG noise, "high" detail only), and species-specific features.
 */
export default function Creature({ art, className, style, detail }: { art: Art; className?: string; style?: CSSProperties; detail?: "high" | "low" }) {
  const uid = useId().replace(/:/g, "");
  const g = (n: string) => `${uid}${n}`;
  const url = (n: string) => `url(#${g(n)})`;
  const hi = (detail ?? (typeof window !== "undefined" && window.innerWidth < 900 ? "low" : "high")) === "high";
  const { body, belly = body, accent = "#0b1a26", glow = "#9ff8ff" } = art;

  /** A shaded body part: countershaded fill + form lighting + (hi) grain and mottling + soft outline. */
  const Part = ({ d, fill = "cs", mottle = false, opacity = 1, outline = true }: { d: string; fill?: string; mottle?: boolean; opacity?: number; outline?: boolean }) => (
    <g opacity={opacity}>
      <path d={d} fill={url(fill)} />
      <path d={d} fill={url("form")} />
      {hi && mottle && <path d={d} fill={accent} filter={url("mottle")} opacity=".32" />}
      {hi && <path d={d} fill="#7f7f7f" filter={url("grain")} opacity=".2" style={{ mixBlendMode: "overlay" }} />}
      {outline && <path d={d} fill="none" stroke={accent} strokeOpacity=".45" strokeWidth=".9" />}
    </g>
  );
  const Eye = ({ cx, cy, r = 2.4, iris = "#0a0d10", glint = true }: { cx: number; cy: number; r?: number; iris?: string; glint?: boolean }) => (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.35} fill={accent} opacity=".45" />
      <circle cx={cx} cy={cy} r={r} fill={url("eye")} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill={iris} />
      {glint && <circle cx={cx + r * 0.35} cy={cy - r * 0.35} r={r * 0.28} fill="#fff" opacity=".9" />}
    </g>
  );
  const Spec = ({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url("spec")} />;

  const defs = (
    <defs>
      <linearGradient id={g("cs")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={body} />
        <stop offset=".55" stopColor={body} />
        <stop offset="1" stopColor={belly} />
      </linearGradient>
      <linearGradient id={g("fin")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={body} stopOpacity=".95" />
        <stop offset="1" stopColor={accent} stopOpacity=".85" />
      </linearGradient>
      <linearGradient id={g("form")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".28" />
        <stop offset=".25" stopColor="#fff" stopOpacity=".05" />
        <stop offset=".6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".38" />
      </linearGradient>
      <radialGradient id={g("spec")}>
        <stop offset="0" stopColor="#fff" stopOpacity=".55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={g("eye")}>
        <stop offset="0" stopColor="#3a4a55" />
        <stop offset="1" stopColor="#0b1116" />
      </radialGradient>
      <radialGradient id={g("glow")}>
        <stop offset="0" stopColor="#fff" />
        <stop offset=".35" stopColor={glow} />
        <stop offset="1" stopColor={glow} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={g("jelly")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={body} stopOpacity=".75" />
        <stop offset="1" stopColor={belly} stopOpacity=".35" />
      </linearGradient>
      {hi && (
        <>
          <filter id={g("grain")} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" />
            <feColorMatrix type="saturate" values="0" />
            <feComposite in2="SourceAlpha" operator="in" />
          </filter>
          <filter id={g("mottle")} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.4 -1.25" result="a" />
            <feComposite in="SourceGraphic" in2="a" operator="in" result="m" />
            <feComposite in="m" in2="SourceAlpha" operator="in" />
          </filter>
        </>
      )}
      <filter id={g("soft")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
    </defs>
  );

  let viewBox = "0 0 200 100";
  let content: ReactNode = null;

  switch (art.kind) {
    // ---------------------------------------------------------------- Blue whale
    case "whale": {
      viewBox = "0 0 420 130";
      const bodyD = "M78 64 C120 50 180 38 262 36 C322 35 370 40 396 52 C408 58 410 66 400 71 C380 82 330 90 262 90 C190 90 122 80 78 68 Z";
      content = (<>
        <g className="tail-v" style={{ transformOrigin: "80px 66px" }}>
          <Part d="M82 63 C60 60 40 50 16 38 C26 54 38 62 54 66 C38 70 26 80 16 96 C40 82 60 72 82 69 Z" fill="fin" />
        </g>
        <Part d={bodyD} mottle />
        {Array.from({ length: 22 }, (_, i) => <ellipse key={i} cx={120 + ((i * 53) % 250)} cy={46 + ((i * 17) % 30)} rx={2 + (i % 3)} ry={1.4 + (i % 2)} fill="#e6eef2" opacity=".18" />)}
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${392 - i * 2} ${71 + i * 1.6} C${350 - i * 6} ${80 + i * 1.2} ${300 - i * 8} ${86 + i * 0.6} ${260 - i * 10} ${88}`} stroke={accent} strokeOpacity=".22" strokeWidth=".9" fill="none" />)}
        <path d="M402 62 C380 66 350 66 330 64" stroke={accent} strokeOpacity=".6" strokeWidth="1.4" fill="none" />
        <path d="M338 40 C342 36 348 36 352 40" stroke={accent} strokeOpacity=".5" strokeWidth="1.5" fill="none" />
        <Part d="M160 45 L174 36 C176 40 178 44 182 46 Z" fill="fin" />
        <g className="flipper" style={{ transformOrigin: "300px 80px" }}><Part d="M304 78 C292 94 270 108 244 116 C258 102 276 90 294 78 Z" fill="fin" /></g>
        <Eye cx={354} cy={63} r={2.6} />
        <Spec cx={300} cy={44} rx={60} ry={6} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Sperm whale
    case "sperm": {
      viewBox = "0 0 420 130";
      content = (<>
        <g className="tail-v" style={{ transformOrigin: "74px 70px" }}>
          <Part d="M78 66 C58 62 40 54 16 44 C24 58 36 66 52 70 C36 74 24 84 16 98 C40 86 58 78 78 74 Z" fill="fin" />
        </g>
        <Part mottle d="M72 68 C110 60 160 54 214 50 L372 44 C396 44 406 58 406 76 C406 94 396 104 376 104 L312 104 C250 102 160 94 110 80 C90 76 78 72 72 70 Z" />
        <Part d="M312 104 C334 110 364 110 386 102 C370 104 340 106 312 104 Z" fill="cs" outline={false} />
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${96 + i * 13} ${60 + (i % 3) * 5} q5 -3 10 0 q5 3 10 0`} stroke={accent} strokeOpacity=".28" strokeWidth="1" fill="none" />)}
        {[150, 170, 188, 204].map((x, i) => <path key={x} d={`M${x} ${56 - (i % 2)} q6 -6 12 0`} fill={body} stroke={accent} strokeOpacity=".3" />)}
        <g className="flipper" style={{ transformOrigin: "296px 96px" }}><Part d="M300 94 C292 104 280 112 268 114 C278 106 286 98 292 92 Z" fill="fin" /></g>
        <Eye cx={322} cy={82} r={2.2} />
        <path d="M404 90 C380 96 350 98 318 98" stroke={accent} strokeOpacity=".5" strokeWidth="1.2" fill="none" />
        <Spec cx={330} cy={52} rx={50} ry={6} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Vaquita (porpoise)
    case "porpoise": {
      viewBox = "0 0 250 100";
      content = (<>
        <g className="tail-v" style={{ transformOrigin: "44px 54px" }}>
          <Part d="M46 52 C34 48 22 40 8 30 C10 40 16 48 26 52 C16 56 10 64 8 74 C22 64 34 58 46 56 Z" fill="fin" />
        </g>
        <Part d="M42 52 C70 32 150 24 200 34 C220 40 232 48 230 56 C226 66 204 72 172 74 C120 78 70 70 42 58 Z" />
        <Part d="M120 34 C124 20 134 8 144 6 C140 16 140 26 146 34 Z" fill="fin" />
        <ellipse cx="208" cy="47" rx="8" ry="5.5" fill={accent} opacity=".85" />
        <path d="M222 56 C226 58 230 58 232 56 C228 62 220 62 214 60 Z" fill={accent} opacity=".85" />
        <path d="M230 57 C224 60 216 60 208 58" stroke={accent} strokeOpacity=".6" strokeWidth="1.2" fill="none" />
        <g className="flipper" style={{ transformOrigin: "172px 66px" }}><Part d="M174 64 C166 76 156 82 146 84 C154 74 162 68 168 62 Z" fill="fin" /></g>
        <Eye cx={208} cy={47} r={2.2} />
        <Spec cx={160} cy={36} rx={34} ry={5} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Hawksbill & green turtle
    case "turtle":
    case "greenturtle": {
      viewBox = "0 0 250 160";
      const hawk = art.kind === "turtle";
      const scutes: [number, number, number][] = [[118, 52, 16], [146, 50, 16], [174, 56, 14], [104, 74, 15], [132, 72, 17], [160, 74, 16], [186, 76, 12], [90, 60, 12]];
      content = (<>
        <g className="flipper-back" style={{ transformOrigin: "74px 92px" }}><Part d="M76 90 C62 102 48 110 34 112 C44 102 56 92 70 86 Z" fill="cs" /></g>
        <g className="flipper-front" style={{ transformOrigin: "170px 92px" }}>
          <Part d="M172 88 C162 112 138 136 108 150 C126 128 146 108 160 86 Z" />
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${164 - i * 11} ${96 + i * 10} l-6 4`} stroke={accent} strokeOpacity=".45" strokeWidth="1.2" />)}
        </g>
        <Part d="M62 74 C68 44 112 28 156 32 C192 36 214 54 216 76 C214 92 188 102 146 104 C104 106 68 98 62 74 Z" mottle />
        {scutes.map(([x, y, r], i) => (
          <g key={i}>
            <path d={`M${x - r} ${y} l${r * 0.45} ${-r * 0.75} h${r * 1.1} l${r * 0.45} ${r * 0.75} l${-r * 0.45} ${r * 0.75} h${-r * 1.1} Z`} fill={hawk ? "#3a1d08" : "#2a3a18"} fillOpacity=".2" stroke={accent} strokeOpacity=".7" strokeWidth="1.3" />
            {hawk && [0, 1, 2, 3].map((k) => <path key={k} d={`M${x} ${y} l${Math.cos(k * 1.6 + i) * r * 0.8} ${Math.sin(k * 1.6 + i) * r * 0.6}`} stroke="#f2c27a" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />)}
            {!hawk && <path d={`M${x - r * 0.6} ${y} Q${x} ${y - r * 0.5} ${x + r * 0.6} ${y}`} stroke="#d8c98a" strokeOpacity=".35" strokeWidth="1.2" fill="none" />}
          </g>
        ))}
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${72 + i * 12} ${96 + Math.sin(i / 2) * 3} q6 5 12 0`} fill="none" stroke={accent} strokeOpacity=".6" strokeWidth="1.2" />)}
        <path d="M70 86 C100 102 170 104 212 86 C200 98 170 106 140 106 C106 106 80 100 70 86 Z" fill={belly} opacity=".85" />
        <Part d={hawk ? "M210 70 C220 58 240 58 246 68 C248 72 246 76 240 78 L232 80 L236 86 L224 80 C218 80 212 78 210 74 Z" : "M210 70 C222 58 242 60 246 70 C248 78 240 84 228 82 C218 82 212 78 210 74 Z"} />
        {[[222, 64], [230, 62], [226, 70], [216, 70]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l4 -2 l4 2 l-4 3 Z`} fill="none" stroke={accent} strokeOpacity=".5" strokeWidth=".8" />)}
        <Eye cx={234} cy={67} r={2.4} iris="#1a0e05" />
        <g className="flipper-front2" style={{ transformOrigin: "168px 60px" }}><Part d="M168 60 C160 40 144 22 124 14 C138 30 150 46 158 64 Z" opacity={0.8} /></g>
        <Spec cx={140} cy={42} rx={46} ry={8} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Reef fish / lanternfish / snailfish
    case "fish":
    case "lanternfish": {
      viewBox = "0 0 170 84";
      const lantern = art.kind === "lanternfish";
      content = (<>
        <g className="tail-h" style={{ transformOrigin: "40px 42px" }}>
          <Part d="M44 42 C34 34 22 24 8 18 C14 32 14 52 8 66 C22 60 34 50 44 42 Z" fill="fin" />
          {[24, 32, 42, 52, 60].map((y) => <path key={y} d={`M42 42 L12 ${y}`} stroke={accent} strokeOpacity=".3" strokeWidth=".7" />)}
        </g>
        <Part d="M40 42 C58 20 108 16 138 30 C150 36 152 46 140 54 C112 66 60 62 40 42 Z" />
        {!lantern && Array.from({ length: 30 }, (_, i) => <path key={i} d={`M${56 + (i % 10) * 8} ${28 + Math.floor(i / 10) * 9} q3 3 6 0`} stroke={accent} strokeOpacity=".22" strokeWidth=".7" fill="none" />)}
        <Part d="M78 22 C86 10 102 8 112 14 L104 24 Z" fill="fin" />
        {lantern && <path d="M60 24 L66 20 L68 26 Z" fill={body} />}
        <Part d="M84 58 C90 66 100 68 106 64 L100 56 Z" fill="fin" />
        <g className="flipper" style={{ transformOrigin: "118px 44px" }}><path d="M118 44 C110 48 104 54 102 58 C110 56 116 50 120 46 Z" fill={url("fin")} opacity=".8" /></g>
        <path d="M122 30 C118 38 118 46 122 52" stroke={accent} strokeOpacity=".45" strokeWidth="1.3" fill="none" />
        <path d="M60 40 C80 38 110 38 134 40" stroke="#fff" strokeOpacity=".25" strokeWidth="1.5" fill="none" />
        {lantern && (
          <g className="photophores">
            {[56, 66, 76, 86, 96, 106, 116].map((x, i) => <circle key={x} cx={x} cy={54 - i * 0.6} r="2.6" fill={url("glow")} />)}
            {[70, 84, 98].map((x) => <circle key={x} cx={x} cy={46} r="2" fill={url("glow")} />)}
            <circle cx="134" cy="34" r="3" fill={url("glow")} />
          </g>
        )}
        <Eye cx={130} cy={36} r={lantern ? 6 : 3.4} iris={lantern ? "#101a2a" : "#0a0d10"} />
        <Spec cx={96} cy={28} rx={26} ry={4} />
      </>);
      break;
    }
    case "snailfish": {
      viewBox = "0 0 180 80";
      content = (<>
        <g className="tail-h" style={{ transformOrigin: "60px 44px" }}>
          <path d="M64 40 C44 38 24 40 4 46 C24 48 44 50 64 50 Z" fill={url("jelly")} />
          <path d="M64 38 C44 32 24 34 6 42 M64 52 C44 56 24 54 6 48" stroke={body} strokeOpacity=".5" strokeWidth="1" fill="none" />
        </g>
        <path d="M58 44 C70 20 124 16 152 30 C168 38 168 52 150 60 C120 70 76 64 58 48 Z" fill={url("jelly")} />
        <path d="M58 44 C70 20 124 16 152 30 C168 38 168 52 150 60 C120 70 76 64 58 48 Z" fill={url("form")} opacity=".7" />
        <ellipse cx="116" cy="46" rx="18" ry="9" fill="#b0506a" opacity=".25" />
        <ellipse cx="96" cy="44" rx="14" ry="6" fill="#6a3040" opacity=".18" />
        <path d="M66 36 C90 26 120 24 140 28" stroke="#fff" strokeOpacity=".45" strokeWidth="2" fill="none" />
        <Eye cx={146} cy={38} r={2.4} iris="#2a1018" />
        <Spec cx={124} cy={30} rx={20} ry={5} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Swordfish
    case "swordfish": {
      viewBox = "0 0 300 100";
      content = (<>
        <g className="tail-h" style={{ transformOrigin: "52px 50px" }}><Part d="M56 50 C44 38 30 20 14 6 C22 30 22 70 14 94 C30 80 44 62 56 50 Z" fill="fin" /></g>
        <path d="M56 46 L64 44 L64 56 L56 54 Z" fill={accent} opacity=".6" />
        <Part d="M52 50 C80 30 150 26 200 36 C214 40 222 46 222 50 C222 54 214 60 200 62 C150 72 80 68 52 50 Z" />
        <path d="M216 47 L298 46 L218 53 Z" fill={body} stroke={accent} strokeOpacity=".4" />
        <Part d="M110 34 C112 16 122 4 136 0 C132 12 132 24 136 34 Z" fill="fin" />
        <g className="flipper" style={{ transformOrigin: "176px 60px" }}><Part d="M176 58 C168 72 156 82 144 86 C152 74 160 64 170 56 Z" fill="fin" /></g>
        <path d="M188 38 C184 46 184 54 188 60" stroke={accent} strokeOpacity=".5" strokeWidth="1.4" fill="none" />
        <Eye cx={200} cy={46} r={4.4} iris="#0c1a2a" />
        <Spec cx={150} cy={36} rx={40} ry={5} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Humpback anglerfish
    case "angler": {
      viewBox = "0 0 180 140";
      content = (<>
        <path d="M118 36 C124 12 148 6 158 18" stroke={body} strokeWidth="3" fill="none" strokeLinecap="round" />
        <g className="lure"><circle cx="158" cy="22" r="18" fill={url("glow")} opacity=".5" /><circle cx="158" cy="22" r="6" fill={url("glow")} /></g>
        <g className="tail-h" style={{ transformOrigin: "34px 76px" }}><Part d="M38 76 C28 66 16 58 4 54 C8 68 8 84 4 98 C16 94 28 86 38 76 Z" fill="fin" /></g>
        <Part mottle d="M34 76 C36 42 82 30 116 40 C140 48 150 66 146 86 C142 104 116 114 84 112 C54 110 34 100 34 76 Z" />
        {hi && Array.from({ length: 26 }, (_, i) => <circle key={i} cx={50 + ((i * 29) % 86)} cy={52 + ((i * 13) % 50)} r=".9" fill="#000" opacity=".4" />)}
        <path d="M100 88 C118 100 138 98 146 84 C138 90 120 94 100 88 Z" fill="#050608" />
        {[102, 110, 118, 126, 134, 140].map((x, i) => <path key={x} d={`M${x} ${89 + (i % 2)} l2.2 ${-8 - (i % 3) * 2} l2 ${8 + (i % 3) * 2}`} fill="#eef3f5" />)}
        {[104, 114, 124, 134].map((x) => <path key={x} d={`M${x} 95 l2 7 l2 -7`} fill="#eef3f5" />)}
        <g className="flipper" style={{ transformOrigin: "82px 88px" }}><Part d="M84 86 C76 96 70 104 62 108 C68 98 74 90 80 84 Z" fill="fin" /></g>
        <Eye cx={118} cy={62} r={3} iris="#000" />
        <Spec cx={96} cy={46} rx={24} ry={5} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Gulper eel
    case "eel": {
      viewBox = "0 0 280 110";
      content = (<>
        <path fill="none" stroke={body} strokeWidth="6" strokeLinecap="round">
          <animate attributeName="d" dur="2.6s" repeatCount="indefinite" values="M186 56 C156 46 126 66 96 56 C66 46 36 66 8 56;M186 56 C156 66 126 46 96 56 C66 66 36 46 8 56;M186 56 C156 46 126 66 96 56 C66 46 36 66 8 56" />
        </path>
        <g className="lure"><circle cx="8" cy="56" r="10" fill={url("glow")} opacity=".6" /><circle cx="8" cy="56" r="3" fill={url("glow")} /></g>
        <Part d="M182 50 C198 20 244 16 262 34 C272 44 270 58 260 66 C246 88 200 90 182 64 Z" />
        <path d="M184 60 C200 76 236 82 256 66 C240 70 210 70 184 60 Z" fill="#070608" opacity=".85" />
        <path d="M262 46 C240 52 212 56 186 56" stroke="#050506" strokeWidth="2.5" fill="none" />
        <Eye cx={256} cy={38} r={1.8} />
        <Spec cx={228} cy={30} rx={22} ry={4} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Giant squid / vampire squid
    case "squid":
    case "vampire": {
      const vamp = art.kind === "vampire";
      viewBox = "0 0 280 110";
      content = (<>
        {Array.from({ length: vamp ? 8 : 8 }, (_, i) => {
          const dy = (i - 3.5) * 4.2;
          return (
            <path key={i} fill="none" stroke={body} strokeWidth={2.6 - Math.abs(i - 3.5) * 0.12} strokeLinecap="round">
              <animate attributeName="d" dur={`${1.8 + i * 0.12}s`} repeatCount="indefinite" values={`M152 ${55 + dy / 2} C124 ${55 + dy} 98 ${55 + dy * 1.7} 72 ${55 + dy * 2.1};M152 ${55 + dy / 2} C124 ${55 + dy * 1.8} 98 ${55 + dy} 72 ${55 + dy * 2.5};M152 ${55 + dy / 2} C124 ${55 + dy} 98 ${55 + dy * 1.7} 72 ${55 + dy * 2.1}`} />
            </path>
          );
        })}
        {!vamp && [-1, 1].map((s) => (
          <g key={s}>
            <path fill="none" stroke={body} strokeWidth="1.6" strokeLinecap="round">
              <animate attributeName="d" dur="3.2s" repeatCount="indefinite" values={`M152 55 C110 ${55 + s * 10} 60 ${55 + s * 18} 10 ${55 + s * 14};M152 55 C110 ${55 + s * 16} 60 ${55 + s * 8} 10 ${55 + s * 20};M152 55 C110 ${55 + s * 10} 60 ${55 + s * 18} 10 ${55 + s * 14}`} />
            </path>
          </g>
        ))}
        {vamp && <Part d="M154 55 C132 30 104 30 86 55 C104 80 132 80 154 55 Z" fill="fin" opacity={0.85} />}
        {vamp && [92, 98, 104].map((x, i) => <circle key={x} cx={x} cy={46 + i * 9} r="3" fill={url("glow")} className="lure" />)}
        <Part mottle d="M150 55 C170 34 226 30 262 44 C274 50 274 60 262 66 C226 80 170 76 150 55 Z" />
        <Part d={vamp ? "M236 40 C244 28 252 26 256 32 C252 38 246 42 238 44 Z" : "M240 44 C256 30 272 30 278 40 C276 50 272 60 278 70 C272 80 256 80 240 66 Z"} fill="fin" />
        {vamp && <Part d="M236 70 C244 82 252 84 256 78 C252 72 246 68 238 66 Z" fill="fin" />}
        {hi && Array.from({ length: 30 }, (_, i) => <circle key={i} cx={160 + ((i * 31) % 96)} cy={42 + ((i * 11) % 26)} r={0.8 + (i % 3) * 0.5} fill={accent} opacity=".45" />)}
        <Eye cx={172} cy={50} r={vamp ? 5 : 7} iris={vamp ? "#2f8fff" : "#101010"} />
        {vamp && <circle cx="172" cy="50" r="10" fill={url("glow")} opacity=".25" />}
        <Spec cx={214} cy={42} rx={30} ry={5} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Giant siphonophore
    case "siphonophore": {
      viewBox = "0 0 90 320";
      content = (<>
        <ellipse cx="45" cy="24" rx="22" ry="20" fill={url("jelly")} />
        <ellipse cx="45" cy="24" rx="22" ry="20" fill="none" stroke={glow} strokeOpacity=".6" />
        <ellipse cx="45" cy="54" rx="18" ry="16" fill={url("jelly")} />
        <ellipse cx="45" cy="54" rx="18" ry="16" fill="none" stroke={glow} strokeOpacity=".5" />
        <path d="M45 70 C44 140 46 220 45 316" stroke={glow} strokeOpacity=".6" strokeWidth="1.4" fill="none" />
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} className="jelly-pulse" style={{ animationDelay: `${i * 0.15}s` }}>
            <circle cx={45 + Math.sin(i) * 2} cy={82 + i * 19} r="4.5" fill={url("glow")} />
            <path fill="none" stroke={glow} strokeOpacity=".35" strokeWidth=".8">
              <animate attributeName="d" dur={`${2.5 + (i % 4) * 0.4}s`} repeatCount="indefinite" values={`M45 ${84 + i * 19} C38 ${96 + i * 19} 50 ${106 + i * 19} 40 ${118 + i * 19};M45 ${84 + i * 19} C52 ${96 + i * 19} 40 ${106 + i * 19} 50 ${118 + i * 19};M45 ${84 + i * 19} C38 ${96 + i * 19} 50 ${106 + i * 19} 40 ${118 + i * 19}`} />
            </path>
          </g>
        ))}
      </>);
      break;
    }
    // ---------------------------------------------------------------- Dumbo octopus
    case "octopus": {
      viewBox = "0 0 170 160";
      content = (<>
        <g className="ear ear-l" style={{ transformOrigin: "56px 54px" }}><path d="M56 54 C38 34 22 36 16 48 C26 56 40 60 56 62 Z" fill={url("jelly")} stroke={accent} strokeOpacity=".4" /></g>
        <g className="ear ear-r" style={{ transformOrigin: "114px 54px" }}><path d="M114 54 C132 34 148 36 154 48 C144 56 130 60 114 62 Z" fill={url("jelly")} stroke={accent} strokeOpacity=".4" /></g>
        <g className="skirt">
          <path d="M44 86 C38 116 50 140 44 156 C60 142 72 126 85 106 C98 126 110 142 126 156 C120 140 132 116 126 86 Z" fill={url("jelly")} />
          {[54, 70, 85, 100, 116].map((x) => <path key={x} d={`M${x} 92 C${x - 2} 116 ${x} 134 ${x - 3} 150`} stroke={accent} strokeOpacity=".3" strokeWidth="1" fill="none" />)}
        </g>
        <Part d="M44 74 C44 30 126 30 126 74 C126 92 108 102 85 102 C62 102 44 92 44 74 Z" />
        <Eye cx={70} cy={74} r={5} iris="#1a0a10" />
        <Eye cx={100} cy={74} r={5} iris="#1a0a10" />
        <Spec cx={82} cy={46} rx={22} ry={8} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Sea pig
    case "seapig": {
      viewBox = "0 0 190 110";
      content = (<>
        {[36, 56, 76, 96, 116, 136, 152].map((x, i) => (
          <g key={x} className="tube-foot" style={{ transformOrigin: `${x}px 82px`, animationDelay: `${i * 0.18}s` }}>
            <path d={`M${x} 80 C${x - 2} 90 ${x - 4} 98 ${x - 6} 104`} stroke={belly} strokeWidth="7" strokeLinecap="round" fill="none" opacity=".9" />
          </g>
        ))}
        <path d="M20 64 C20 38 62 28 104 30 C146 32 172 46 172 66 C172 80 146 88 100 88 C56 88 20 82 20 64 Z" fill={url("jelly")} />
        <path d="M20 64 C20 38 62 28 104 30 C146 32 172 46 172 66 C172 80 146 88 100 88 C56 88 20 82 20 64 Z" fill={url("form")} opacity=".6" />
        {[[134, 34, 146, 10], [146, 38, 162, 18], [124, 32, 130, 12]].map(([x1, y1, x2, y2], i) => <path key={i} className="antenna" d={`M${x1} ${y1} C${x1 + 2} ${(y1 + y2) / 2} ${x2 - 4} ${y2 + 6} ${x2} ${y2}`} stroke={body} strokeWidth="5" strokeLinecap="round" fill="none" />)}
        <ellipse cx="96" cy="60" rx="30" ry="10" fill="#b0506a" opacity=".2" />
        <Eye cx={160} cy={56} r={1.6} glint={false} />
        <Spec cx={96} cy={40} rx={40} ry={7} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Tripod fish
    case "tripod": {
      viewBox = "0 0 190 160";
      content = (<>
        <Part d="M44 52 L10 38 C14 48 14 58 10 68 Z" fill="fin" />
        <Part d="M40 52 C60 38 114 36 146 44 C156 48 156 58 146 62 C114 70 60 66 40 52 Z" />
        <path d="M62 60 C58 94 50 124 44 156 M72 60 C76 94 82 124 88 156 M46 56 C40 90 24 122 12 156" stroke={body} strokeWidth="1.8" fill="none" opacity=".9" />
        <path d="M126 42 C140 26 160 20 184 22 M128 44 C144 34 162 32 186 36" stroke={body} strokeWidth="1.3" fill="none" opacity=".75" />
        <Part d="M84 42 C90 30 104 28 112 34 L104 42 Z" fill="fin" />
        <Eye cx={140} cy={50} r={1.8} />
        <Spec cx={100} cy={42} rx={26} ry={4} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Hadal amphipod
    case "shrimp": {
      viewBox = "0 0 150 96";
      content = (<>
        {[48, 62, 76, 90, 104].map((x, i) => <path key={x} className="shrimp-leg" style={{ transformOrigin: `${x}px 70px`, animationDelay: `${i * 0.08}s` }} d={`M${x} 68 l-3 12 l-4 8`} stroke={body} strokeWidth="2.2" strokeLinecap="round" fill="none" />)}
        <Part d="M18 62 C22 30 72 18 110 32 C126 38 132 52 124 64 C106 74 62 76 40 70 C28 68 20 66 18 62 Z" />
        {[36, 52, 68, 84, 100].map((x) => <path key={x} d={`M${x} 28 C${x + 5} 44 ${x + 5} 60 ${x} 72`} stroke={accent} strokeOpacity=".5" strokeWidth="1.3" fill="none" />)}
        <Part d="M20 62 L4 52 L8 66 L2 76 Z" fill="fin" />
        <path d="M118 38 C130 20 138 10 146 4 M122 42 C134 34 142 32 148 32" stroke={body} strokeWidth="1.4" fill="none" />
        <Eye cx={116} cy={44} r={2.6} iris="#2a1a0a" />
        <Spec cx={76} cy={30} rx={28} ry={5} />
      </>);
      break;
    }
    // ---------------------------------------------------------------- Xenophyophore
    case "xeno": {
      viewBox = "0 0 170 120";
      content = (<>
        <Part mottle d="M20 114 C16 80 34 52 56 56 C62 34 88 24 106 40 C122 28 150 42 146 70 C160 84 156 108 150 114 Z" />
        {[[48, 80, 7], [70, 64, 6], [98, 56, 8], [122, 72, 7], [86, 88, 9], [60, 98, 6], [118, 98, 7], [136, 92, 5], [102, 76, 5]].map(([x, y, r], i) => (
          <g key={i}><circle cx={x} cy={y} r={r} fill="#1a1712" opacity=".55" /><circle cx={x} cy={y} r={r} fill="none" stroke={glow} strokeOpacity=".25" strokeWidth="1.2" /></g>
        ))}
        <Spec cx={90} cy={48} rx={30} ry={8} />
      </>);
      break;
    }
  }

  return (
    <svg viewBox={viewBox} className={`creature-svg kind-${art.kind} ${className ?? ""}`} style={style} aria-hidden="true">
      {defs}
      {content}
    </svg>
  );
}
