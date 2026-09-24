import { useId, type CSSProperties } from "react";

/**
 * Detailed side-view scuba diver swimming to the right. Limbs are filled, form-shaded shapes
 * (light from above), legs flutter-kick (speed via --kick), hair drifts, arms sway.
 * `suitHue` shifts the wetsuit accent panels.
 */
export default function Diver({ suitHue = 0, kick, className, style }: { suitHue?: number; kick?: number; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const u = (n: string) => `url(#${id}${n})`;
  const hue = (178 + suitHue) % 360;
  const accent = `hsl(${hue} 70% 46%)`;
  const accentHi = `hsl(${hue} 80% 62%)`;
  return (
    <svg viewBox="-40 0 300 120" className={`diver-svg ${className ?? ""}`} style={kick ? { ...style, ["--kick" as string]: `${kick}s` } : style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}neo`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4552" /><stop offset=".35" stopColor="#1d232b" /><stop offset=".8" stopColor="#0f1318" /><stop offset="1" stopColor="#07090c" /></linearGradient>
        <linearGradient id={`${id}neoFar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#222831" /><stop offset="1" stopColor="#06080a" /></linearGradient>
        <linearGradient id={`${id}tank`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c4" /><stop offset=".18" stopColor="#ffd45e" /><stop offset=".55" stopColor="#e3a524" /><stop offset="1" stopColor="#7c4c08" /></linearGradient>
        <linearGradient id={`${id}chrome`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2f5f7" /><stop offset=".5" stopColor="#8e98a1" /><stop offset="1" stopColor="#3c434a" /></linearGradient>
        <linearGradient id={`${id}skin`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4cfae" /><stop offset=".6" stopColor="#d9a47f" /><stop offset="1" stopColor="#a8704f" /></linearGradient>
        <linearGradient id={`${id}hair`} x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#3a2216" /><stop offset=".6" stopColor="#5a3522" /><stop offset="1" stopColor="#7a4a2c" stopOpacity=".6" /></linearGradient>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6fdff" stopOpacity=".95" /><stop offset=".45" stopColor="#6cd0e3" stopOpacity=".55" /><stop offset="1" stopColor="#0f5470" stopOpacity=".85" /></linearGradient>
        <linearGradient id={`${id}fin`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={accentHi} stopOpacity=".35" /><stop offset=".55" stopColor={accent} stopOpacity=".85" /><stop offset="1" stopColor="#0c1014" /></linearGradient>
        <linearGradient id={`${id}sheen`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>

      {/* ---------- far leg ---------- */}
      <g className="leg leg-far" style={{ transformOrigin: "108px 62px" }}>
        <path d="M112 54 C98 53 82 54 66 56 C62 58 62 64 66 66 C82 66 98 66 112 66 Z" fill={u("neoFar")} />
        <g className="shin" style={{ transformOrigin: "66px 61px" }}>
          <path d="M68 56 C56 57 44 58 34 58 C30 60 30 64 34 66 C44 66 56 66 68 66 Z" fill={u("neoFar")} />
          <g className="fin" style={{ transformOrigin: "36px 62px" }}>
            <path d="M40 55 L-24 49 C-32 55 -32 69 -24 74 L40 69 Z" fill={u("fin")} opacity=".75" />
            <path d="M38 56 L-24 50 M38 68 L-24 73" stroke="#0a0d10" strokeWidth="2" />
          </g>
        </g>
      </g>

      {/* ---------- far arm ---------- */}
      <g className="arm arm-far" style={{ transformOrigin: "186px 52px" }}>
        <path d="M182 48 C194 56 204 64 214 70 C216 74 212 78 208 76 C198 70 188 62 180 56 Z" fill={u("neoFar")} />
        <path d="M208 70 C214 70 222 74 222 78 C218 80 212 80 208 76 Z" fill="#0a0c0f" />
      </g>

      {/* ---------- cylinder, valve, first stage ---------- */}
      <rect x="92" y="15" width="92" height="23" rx="11.5" fill={u("tank")} />
      <rect x="92" y="15" width="92" height="23" rx="11.5" fill="none" stroke="#6b3f06" strokeOpacity=".5" />
      <rect x="96" y="30" width="18" height="8" rx="3" fill="#1b1f24" opacity=".85" />
      <path d="M100 19 H178" stroke="#fffbe6" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
      <rect x="182" y="21" width="12" height="11" rx="3" fill={u("chrome")} />
      <circle cx="190" cy="18" r="4" fill="#222" /><circle cx="190" cy="18" r="2" fill="#555" />
      <rect x="192" y="24" width="8" height="7" rx="2" fill={u("chrome")} />

      {/* ---------- torso (wetsuit + BCD) ---------- */}
      <path d="M100 46 C122 36 170 34 196 42 C206 46 207 66 196 71 C170 78 124 78 100 71 C90 66 90 52 100 46 Z" fill={u("neo")} />
      <path d="M100 46 C122 36 170 34 196 42 C206 46 207 66 196 71 C170 78 124 78 100 71 C90 66 90 52 100 46 Z" fill={u("sheen")} />
      <path d="M110 50 C140 43 172 42 192 46" stroke={accent} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M112 49 C140 42 170 41 190 45" stroke={accentHi} strokeOpacity=".6" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M118 71 C142 75 168 74 188 69" stroke={accent} strokeOpacity=".7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* BCD */}
      <path d="M136 40 C150 38 166 38 176 40 L178 72 C164 75 150 75 136 73 Z" fill="#11151a" opacity=".92" />
      <rect x="146" y="54" width="22" height="14" rx="4" fill="#1c2229" stroke="#2c343d" />
      <path d="M150 60 H164" stroke="#3b4550" strokeWidth="1.2" />
      <path d="M140 41 C142 52 142 62 140 73 M174 40 C176 52 176 62 174 72" stroke="#050607" strokeWidth="3" fill="none" />
      {/* weight belt */}
      <path d="M112 56 C114 62 114 70 112 76" stroke="#07090b" strokeWidth="7" fill="none" />
      <rect x="108" y="62" width="9" height="8" rx="1.5" fill={u("chrome")} />
      {[118, 124].map((x) => <rect key={x} x={x} y="58" width="5" height="13" rx="1" fill="#2a3037" />)}

      {/* ---------- hoses ---------- */}
      <path d="M194 30 C214 18 242 30 240 56" stroke="#0e1216" strokeWidth="3.4" fill="none" />
      <path d="M194 32 C204 44 200 62 186 74" stroke="#f1c21b" strokeWidth="2.6" fill="none" />
      <circle cx="184" cy="76" r="4" fill="#f1c21b" stroke="#6b5200" />
      <path d="M190 34 C176 52 170 70 160 88" stroke="#0e1216" strokeWidth="2.4" fill="none" />
      <circle cx="158" cy="92" r="6" fill="#1b2026" stroke={u("chrome")} strokeWidth="1.5" />
      <circle cx="158" cy="92" r="3.6" fill="#e9f3f6" />
      <path d="M158 92 L160.5 89.5" stroke="#d33" strokeWidth="1" />

      {/* ---------- near leg ---------- */}
      <g className="leg leg-near" style={{ transformOrigin: "106px 66px" }}>
        <path d="M110 57 C94 57 80 58 64 60 C59 62 59 70 64 72 C80 72 94 73 110 74 Z" fill={u("neo")} />
        <path d="M108 59 C94 59 80 60 68 61" stroke={accentHi} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M110 57 C94 57 80 58 64 60 C59 62 59 70 64 72 C80 72 94 73 110 74 Z" fill={u("sheen")} />
        <g className="shin" style={{ transformOrigin: "64px 66px" }}>
          <path d="M66 60 C54 61 44 62 32 62 C27 64 27 70 32 72 C44 72 54 72 66 72 Z" fill={u("neo")} />
          <path d="M40 62 C36 58 30 58 26 62 L26 71 C30 74 36 74 40 71 Z" fill="#0b0e11" />
          <g className="fin" style={{ transformOrigin: "34px 67px" }}>
            <path d="M38 60 L-34 53 C-44 60 -44 76 -34 82 L38 75 Z" fill={u("fin")} />
            <path d="M36 61 L-34 54 M36 74 L-34 81" stroke="#0a0d10" strokeWidth="2.4" />
            {[-20, -6, 8, 22].map((x) => <path key={x} d={`M${x} ${57 + (x + 34) * 0.02} L${x} ${79 - (x + 34) * 0.02}`} stroke="#fff" strokeOpacity=".08" strokeWidth="1" />)}
          </g>
        </g>
      </g>

      {/* ---------- hair (drifts behind head) ---------- */}
      <g className="hair" style={{ transformOrigin: "204px 44px" }}>
        <path d="M208 36 C192 28 172 30 156 22 C166 34 180 40 194 44 C178 44 164 52 150 52 C166 58 188 54 202 50 Z" fill={u("hair")} />
        {[[204, 38, 168, 28], [202, 42, 160, 44], [204, 46, 172, 52], [206, 40, 176, 34]].map(([x1, y1, x2, y2], i) => (
          <path key={i} d={`M${x1} ${y1} C${(x1 + x2) / 2} ${y1 - 3} ${(x1 + x2) / 2} ${y2 + 3} ${x2} ${y2}`} stroke="#8a5a36" strokeOpacity=".55" strokeWidth=".9" fill="none" />
        ))}
      </g>

      {/* ---------- head ---------- */}
      <path d="M200 44 C200 34 210 32 218 34 C228 36 232 44 231 54 C232 60 230 66 224 68 C216 70 206 68 202 62 C198 58 198 50 200 44 Z" fill={u("skin")} />
      <path d="M198 46 C202 34 222 30 230 42 C220 38 208 38 198 46 Z" fill="#3a2216" />
      <path d="M206 52 C204 50 204 56 207 57" stroke="#a8704f" strokeWidth="1.4" fill="none" />
      <path d="M198 49 C212 45 224 45 232 49" stroke="#0c0f12" strokeWidth="3.4" fill="none" />
      {/* mask */}
      <path d="M214 40 C220 38 232 38 236 42 C238 48 238 54 234 57 C228 59 220 59 215 57 C212 52 212 45 214 40 Z" fill="#0b0e11" />
      <path d="M216 42 C221 40 230 40 234 43 C235 48 235 52 232 55 C227 56 221 56 217 55 C215 51 215 46 216 42 Z" fill={u("glass")} />
      <path d="M219 44 L225 43" stroke="#fff" strokeOpacity=".9" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M229 52 L232 50" stroke="#fff" strokeOpacity=".45" strokeWidth="1" strokeLinecap="round" />
      <path d="M226 60 C230 62 234 62 236 60" stroke="#8f5d42" strokeWidth="1.2" fill="none" />
      {/* regulator second stage */}
      <path d="M228 58 C234 56 242 58 244 64 C242 70 234 72 228 68 Z" fill="#161b21" />
      <circle cx="240" cy="64" r="3.2" fill="#2d353e" stroke="#46505b" />

      {/* ---------- near arm ---------- */}
      <g className="arm arm-near" style={{ transformOrigin: "184px 54px" }}>
        <path d="M180 50 C190 62 202 74 216 80 C220 83 218 88 214 88 C200 84 186 72 176 58 Z" fill={u("neo")} />
        <path d="M182 52 C192 64 202 72 212 78" stroke={accentHi} strokeOpacity=".5" strokeWidth="1.5" fill="none" />
        <path d="M214 80 C220 78 228 80 230 84 C231 88 226 90 222 90 C218 90 214 88 214 86 Z" fill="#0c0f12" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${226 + i} ${82 + i * 2.2} l6 ${1 + i * 0.5}`} stroke="#1c2228" strokeWidth="2" strokeLinecap="round" />)}
      </g>
    </svg>
  );
}
