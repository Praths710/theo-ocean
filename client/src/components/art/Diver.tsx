import type { CSSProperties } from "react";

/**
 * Side-view scuba diver, swimming to the right. Legs flutter-kick (speed via --kick),
 * hair drifts, arms sway. `suitHue` shifts the wetsuit accent colour.
 */
export default function Diver({ suitHue = 0, kick, className, style }: { suitHue?: number; kick?: number; className?: string; style?: CSSProperties }) {
  const hue = (178 + suitHue) % 360;
  const suit = `hsl(${hue} 55% 34%)`;
  const suitLight = `hsl(${hue} 60% 48%)`;
  const suitDark = `hsl(${hue} 45% 20%)`;
  const id = `d${hue}`;
  return (
    <svg viewBox="-40 0 300 120" className={`diver-svg ${className ?? ""}`} style={kick ? { ...style, ["--kick" as string]: `${kick}s` } : style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-tank`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe28a" /><stop offset=".45" stopColor="#f2b233" /><stop offset="1" stopColor="#9c6410" /></linearGradient>
        <linearGradient id={`${id}-suit`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b3440" /><stop offset=".5" stopColor="#171d25" /><stop offset="1" stopColor="#0c1015" /></linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9fbff" stopOpacity=".95" /><stop offset=".5" stopColor="#6fd3e6" stopOpacity=".55" /><stop offset="1" stopColor="#1b6b86" stopOpacity=".8" /></linearGradient>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1c7a4" /><stop offset="1" stopColor="#c98f6c" /></linearGradient>
        <linearGradient id={`${id}-fin`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={suitLight} stopOpacity=".55" /><stop offset=".6" stopColor={suit} /><stop offset="1" stopColor="#0f141a" /></linearGradient>
      </defs>

      {/* far leg (behind body) */}
      <g className="leg leg-far" style={{ transformOrigin: "108px 64px" }}>
        <path d="M110 60 C92 58 78 58 66 60" stroke="#0e1319" strokeWidth="15" strokeLinecap="round" fill="none" />
        <g className="shin" style={{ transformOrigin: "66px 60px" }}>
          <path d="M66 60 C54 61 44 62 34 62" stroke="#0e1319" strokeWidth="12" strokeLinecap="round" fill="none" />
          <path className="fin" d="M36 56 L-26 50 C-34 56 -34 66 -26 72 L36 68 Z" fill={`url(#${id}-fin)`} opacity=".75" style={{ transformOrigin: "36px 62px" }} />
        </g>
      </g>

      {/* far arm */}
      <g className="arm arm-far" style={{ transformOrigin: "186px 52px" }}>
        <path d="M186 52 C196 62 204 70 214 74" stroke="#0e1319" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="217" cy="75" r="5.5" fill="#0e1319" />
      </g>

      {/* tank + valve */}
      <rect x="96" y="20" width="84" height="20" rx="10" fill={`url(#${id}-tank)`} />
      <rect x="176" y="24" width="10" height="12" rx="3" fill="#6d7780" />
      <path d="M100 26 H176" stroke="#fff4c4" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />

      {/* torso */}
      <path d="M100 46 C122 36 170 34 194 42 C204 46 205 66 194 71 C168 78 124 78 100 71 C90 66 90 52 100 46 Z" fill={`url(#${id}-suit)`} />
      {/* suit accent panels */}
      <path d="M112 50 C140 44 170 43 190 47" stroke={suitLight} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M118 70 C142 74 168 73 188 68" stroke={suit} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* BCD straps + weight belt */}
      <path d="M150 40 C152 52 152 64 150 76" stroke="#0a0d11" strokeWidth="5" fill="none" />
      <rect x="112" y="58" width="8" height="17" rx="2" fill="#3a4450" />
      <rect x="111" y="64" width="10" height="6" rx="1.5" fill="#9aa6b2" />

      {/* hose from valve to regulator */}
      <path d="M182 30 C206 20 236 34 236 58" stroke="#11161c" strokeWidth="3.5" fill="none" />

      {/* near leg */}
      <g className="leg leg-near" style={{ transformOrigin: "106px 66px" }}>
        <path d="M108 66 C92 66 78 66 64 67" stroke={`url(#${id}-suit)`} strokeWidth="17" strokeLinecap="round" fill="none" />
        <path d="M104 62 C92 62 80 62 70 63" stroke={suitLight} strokeOpacity=".7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <g className="shin" style={{ transformOrigin: "64px 67px" }}>
          <path d="M64 67 C52 68 42 69 32 69" stroke="#161c24" strokeWidth="13" strokeLinecap="round" fill="none" />
          <path className="fin" d="M34 62 L-32 56 C-40 63 -40 75 -32 81 L34 76 Z" fill={`url(#${id}-fin)`} style={{ transformOrigin: "34px 69px" }} />
          <path d="M30 64 L-28 60 M30 74 L-28 78" stroke={suitLight} strokeOpacity=".5" strokeWidth="1.5" />
        </g>
      </g>

      {/* hair (drifts behind the head) */}
      <g className="hair" style={{ transformOrigin: "204px 44px" }}>
        <path d="M206 38 C190 30 172 32 160 26 C170 36 182 40 192 44 C178 44 168 50 156 50 C170 54 188 52 200 50 Z" fill="#3b2418" />
        <path d="M204 40 C192 36 180 38 170 34" stroke="#6b4430" strokeWidth="1.5" fill="none" />
      </g>

      {/* head */}
      <circle cx="212" cy="52" r="15" fill={`url(#${id}-skin)`} />
      <path d="M198 46 C202 34 222 32 228 44 C220 40 208 40 198 46 Z" fill="#3b2418" />
      <path d="M200 50 C212 46 222 46 230 50" stroke="#101418" strokeWidth="3.5" fill="none" />
      {/* mask */}
      <rect x="216" y="41" width="17" height="15" rx="5" fill="#101418" />
      <rect x="218" y="43" width="13" height="11" rx="3.5" fill={`url(#${id}-glass)`} />
      <path d="M220 45 L225 45" stroke="#fff" strokeOpacity=".85" strokeWidth="1.5" strokeLinecap="round" />
      {/* regulator */}
      <rect x="226" y="58" width="10" height="8" rx="3" fill="#1d242c" />
      <circle cx="237" cy="62" r="3" fill="#3a4450" />

      {/* near arm */}
      <g className="arm arm-near" style={{ transformOrigin: "184px 56px" }}>
        <path d="M184 56 C194 70 206 80 220 82" stroke={`url(#${id}-suit)`} strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M188 60 C198 72 206 77 214 79" stroke={suitLight} strokeOpacity=".6" strokeWidth="2" fill="none" />
        <circle cx="223" cy="82" r="6" fill="#161c24" />
      </g>
      <circle cx="194" cy="68" r="3" fill="#e84b4b" />
    </svg>
  );
}
