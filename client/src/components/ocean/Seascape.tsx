import type { ReactNode } from "react";

// Scenery per zone, drawn in a 1600x900 box. Two layers: "far" (hazy, slow parallax)
// and "near" (kelp, coral, seafloor). `Seascape` fills one screen; `SeascapeStrip` repeats a
// layer across a wide scrolling world (odd tiles mirrored so the edges join seamlessly).

function Kelp({ x, h, delay, color }: { x: number; h: number; delay: number; color: string }) {
  const leaves = Math.floor(h / 55);
  return (
    <g className="kelp" style={{ transformOrigin: `${x}px 900px`, animationDelay: `${delay}s` }}>
      <path d={`M${x} 900 C${x - 14} ${900 - h * 0.35} ${x + 18} ${900 - h * 0.7} ${x} ${900 - h}`} stroke={color} strokeWidth="5" fill="none" />
      {Array.from({ length: leaves }, (_, i) => {
        const y = 900 - (i + 1) * (h / (leaves + 1));
        const s = i % 2 ? 1 : -1;
        return <path key={i} d={`M${x} ${y} c${s * 18} -6 ${s * 34} -2 ${s * 44} 10 c${-s * 14} 2 ${-s * 30} 0 ${-s * 44} -10 Z`} fill={color} opacity=".9" />;
      })}
    </g>
  );
}

function Coral({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C-4 -30 -20 -40 -24 -70 M0 0 C2 -40 0 -60 6 -90 M0 0 C8 -24 26 -34 30 -60 M6 -50 C14 -60 20 -64 28 -78 M-12 -40 C-22 -48 -30 -50 -38 -58" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Rock({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M-60 0 C-58 -30 -30 -52 0 -54 C30 -56 56 -34 62 0 Z" fill={color} />;
}

function layerContent(zoneIndex: number, layer: "far" | "near"): ReactNode {
  if (zoneIndex === 0) {
    return layer === "far" ? (<>
      <path d="M0 780 C200 720 320 760 480 730 C640 700 760 760 920 740 C1100 716 1260 770 1400 740 C1500 720 1560 736 1600 780 V900 H0 Z" fill="#0b4660" opacity=".55" />
      {[140, 420, 700, 1010, 1300, 1520].map((x, i) => <Coral key={x} x={x} y={770 - (i % 2) * 20} s={0.9 + (i % 3) * 0.2} color="#1f6a78" />)}
    </>) : (<>
      {[60, 170, 700, 780, 1340, 1440].map((x, i) => <Kelp key={x} x={x} h={380 + (i % 3) * 120} delay={i * 0.7} color={i % 2 ? "#2c6b3a" : "#3c7d3a"} />)}
      <path d="M0 850 C120 820 260 840 380 826 C520 810 600 846 760 836 C900 826 1040 850 1180 832 C1320 816 1460 846 1600 850 V900 H0 Z" fill="#c9b387" opacity=".55" />
      <Rock x={560} y={860} s={0.9} color="#3b5560" />
      <Coral x={360} y={846} s={1.1} color="#e07a6a" />
      <Coral x={430} y={850} s={0.8} color="#f0b35a" />
      <Coral x={1120} y={840} s={1.2} color="#d86a8e" />
      <Coral x={1210} y={846} s={0.7} color="#f28c5a" />
      {[520, 580, 900, 960, 1010].map((x, i) => <ellipse key={x} cx={x} cy={848 - (i % 2) * 4} rx={16 + (i % 3) * 6} ry={10} fill={["#7b5aa6", "#3f8f8a", "#c55a7a"][i % 3]} opacity=".8" />)}
    </>);
  }
  if (zoneIndex === 1) {
    return layer === "far" ? (
      <path d="M0 900 V760 C200 700 360 780 560 720 C760 660 900 760 1100 700 C1300 640 1450 740 1600 760 V900 Z" fill="#031a2c" opacity=".8" />
    ) : (<>
      <path d="M0 900 V860 C300 840 600 870 900 850 C1200 830 1400 866 1600 860 V900 Z" fill="#06223a" />
      <Rock x={300} y={870} s={1.4} color="#082b44" />
      <Rock x={1250} y={872} s={1.1} color="#082b44" />
    </>);
  }
  if (zoneIndex === 2) {
    return layer === "far" ? (
      <path d="M0 900 V700 C120 660 200 690 300 640 C380 600 420 660 520 680 C640 700 760 620 900 650 C1040 680 1200 610 1340 650 C1460 684 1540 660 1600 700 V900 Z" fill="#020b14" />
    ) : (
      <path d="M0 900 V870 C400 850 800 880 1200 860 C1400 850 1500 866 1600 870 V900 Z" fill="#01070d" />
    );
  }
  if (zoneIndex === 3) {
    return layer === "far" ? (
      <path d="M0 830 C300 790 600 820 900 800 C1200 780 1400 810 1600 830 V900 H0 Z" fill="#101315" opacity=".8" />
    ) : (<>
      <path d="M0 836 C300 820 700 846 1000 830 C1300 816 1500 840 1600 836 V900 H0 Z" fill="#1c1f21" />
      <path d="M0 856 C300 846 700 862 1000 852 C1300 842 1500 858 1600 856 V900 H0 Z" fill="#26292b" />
      {Array.from({ length: 26 }, (_, i) => <ellipse key={i} cx={40 + i * 61 + (i % 3) * 13} cy={860 + (i % 4) * 8} rx={6 + (i % 3) * 3} ry={4 + (i % 2) * 2} fill="#0f1112" />)}
    </>);
  }
  return layer === "far" ? (
    <path d="M0 0 H220 C190 200 260 380 200 560 C170 700 240 820 210 900 H0 Z M1600 0 H1380 C1420 180 1340 400 1410 560 C1460 700 1370 820 1400 900 H1600 Z" fill="#05080b" />
  ) : (
    <path d="M0 900 V872 C400 860 1200 860 1600 872 V900 Z" fill="#0b0e10" />
  );
}

/** Single-screen scenery (login, dashboard). */
export default function Seascape({ zoneIndex }: { zoneIndex: number }) {
  return (
    <div className="seascape" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="scape-layer far">{layerContent(zoneIndex, "far")}</svg>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="scape-layer near">{layerContent(zoneIndex, "near")}</svg>
    </div>
  );
}

/** One layer repeated `tiles` times, each `tileWidth` px wide, for side-scrolling. */
export function SeascapeStrip({ zoneIndex, layer, tiles, tileWidth }: { zoneIndex: number; layer: "far" | "near"; tiles: number; tileWidth: number }) {
  const content = layerContent(zoneIndex, layer);
  return (
    <div className={`seascape-strip ${layer}`} style={{ width: tiles * tileWidth }} aria-hidden="true">
      {Array.from({ length: tiles }, (_, i) => (
        <svg key={i} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" style={{ left: i * tileWidth, width: tileWidth, transform: i % 2 ? "scaleX(-1)" : undefined }}>{content}</svg>
      ))}
    </div>
  );
}
