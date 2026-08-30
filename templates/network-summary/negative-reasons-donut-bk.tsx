import type { NetworkSummaryReasonSegment } from "@/lib/reports/network-summary/types";

/** Rojo intenso → verde oscuro, sin colores pastel, como pide la referencia. */
const PALETTE = ["#E00000", "#E85D2A", "#FF6500", "#FF9500", "#08751D", "#046014"];

type Props = {
  segments: NetworkSummaryReasonSegment[];
};

const SIZE = 344;
const RADIUS = SIZE / 2;
const CENTER = SIZE / 2;

function pointOnCircle(angleDeg: number, radius: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

export function NegativeReasonsDonutBk({ segments }: Props) {
  if (segments.length === 0) {
    return (
      <div className="nwsbk-donut-empty">
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="#c9c9c9" strokeWidth="1.4" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          <path d="M9 10h.01M15 10h.01M9 15c.7-1 2.3-1 3 0" />
        </svg>
        <p>Sin reseñas negativas en este periodo</p>
      </div>
    );
  }

  const slices = segments.reduce<{ color: string; startDeg: number; endDeg: number; percent: number }[]>(
    (acc, segment, index) => {
      const startDeg = acc.length > 0 ? acc[acc.length - 1].endDeg : 0;
      const endDeg = startDeg + (segment.percent / 100) * 360;
      acc.push({ color: PALETTE[index % PALETTE.length], startDeg, endDeg, percent: segment.percent });
      return acc;
    },
    []
  );

  const labelRadius = RADIUS * 0.62;

  return (
    <svg
      viewBox={`${-6} ${-6} ${SIZE + 12} ${SIZE + 12}`}
      width={SIZE}
      height={SIZE}
      className="nwsbk-donut__svg"
    >
      <defs>
        <filter id="nwsbk-donut-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#000" floodOpacity="0.22" />
        </filter>
      </defs>
      <g filter="url(#nwsbk-donut-shadow)">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="#F1F1F1" />
        {slices.map((slice, index) => {
          const start = pointOnCircle(slice.startDeg, RADIUS);
          const end = pointOnCircle(slice.endDeg, RADIUS);
          const largeArc = slice.endDeg - slice.startDeg > 180 ? 1 : 0;
          const isFullCircle = slice.endDeg - slice.startDeg >= 359.999;
          const d = isFullCircle
            ? `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`
            : `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;

          return <path key={index} d={d} fill={slice.color} />;
        })}
      </g>
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#fff" strokeWidth={3} />
      {slices.map((slice, index) => {
        const midDeg = (slice.startDeg + slice.endDeg) / 2;
        const label = pointOnCircle(midDeg, labelRadius);
        const showLabel = slice.percent >= 5;
        if (!showLabel) return null;
        return (
          <text
            key={index}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize="24"
            fontWeight="700"
            fontFamily="'Oswald', sans-serif"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
          >
            {slice.percent.toFixed(1).replace(".", ",")}%
          </text>
        );
      })}
    </svg>
  );
}
