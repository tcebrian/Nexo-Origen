import type { NetworkSummaryReasonSegment } from "@/lib/reports/network-summary/types";

/** Marrón chocolate → beige caramelo, alternando tonos oscuros/claros — sin naranja ni pastel tecnológico. */
const PALETTE = ["#4A290A", "#D6A166", "#8B5A2B", "#C9A876", "#2B1808", "#E8C896"];

type Props = {
  segments: NetworkSummaryReasonSegment[];
};

const SIZE = 290;
// Agujero central ~43% del diámetro, como pide el spec de Santa Gloria.
const OUTER_RADIUS = SIZE / 2;
const INNER_RADIUS = OUTER_RADIUS * 0.43;
const STROKE = OUTER_RADIUS - INNER_RADIUS;
const RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function NegativeReasonsDonutSg({ segments }: Props) {
  if (segments.length === 0) {
    return (
      <div className="nwssg-donut-empty">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#8a7a6a" strokeWidth="1.4" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          <path d="M9 10h.01M15 10h.01M9 15c.7-1 2.3-1 3 0" />
        </svg>
        <p>Sin reseñas negativas en este periodo</p>
      </div>
    );
  }

  const arcs = segments.reduce<{ color: string; length: number; offset: number; percent: number }[]>(
    (acc, segment, index) => {
      const length = (segment.percent / 100) * CIRC;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
      acc.push({ color: PALETTE[index % PALETTE.length], length, offset, percent: segment.percent });
      return acc;
    },
    []
  );

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="nwssg-donut__svg">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#EFE6DB" strokeWidth={STROKE} />
      {arcs.map((arc, index) => {
        const midOffset = arc.offset + arc.length / 2;
        const angleDeg = (midOffset / CIRC) * 360 - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const lx = SIZE / 2 + RADIUS * Math.cos(angleRad);
        const ly = SIZE / 2 + RADIUS * Math.sin(angleRad);
        const showLabel = arc.percent >= 8;
        return (
          <g key={index}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(arc.length - 2, 0)} ${CIRC - arc.length + 2}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
            {showLabel ? (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize="19"
                fontWeight="600"
                fontFamily="'Montserrat', sans-serif"
              >
                {arc.percent.toFixed(1).replace(".", ",")}%
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
