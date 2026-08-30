import type { NetworkSummaryReasonSegment } from "@/lib/reports/network-summary/types";

/** Naranja fuerte → naranja/amarillo → turquesa → amarillo-naranja, sin pastel. */
const PALETTE = ["#F76800", "#FF9B17", "#35B8B4", "#FFCB3D", "#E85500", "#FFE08A"];

type Props = {
  segments: NetworkSummaryReasonSegment[];
};

const SIZE = 250;
// Agujero central ~38% del diámetro, como pide el spec de Popeyes (a
// diferencia del donut de BK, que es un círculo completo sin agujero).
const OUTER_RADIUS = SIZE / 2;
const INNER_RADIUS = OUTER_RADIUS * 0.38;
const STROKE = OUTER_RADIUS - INNER_RADIUS;
const RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function NegativeReasonsDonutPp({ segments }: Props) {
  if (segments.length === 0) {
    return (
      <div className="nwspp-donut-empty">
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="#c9c9c9" strokeWidth="1.4" aria-hidden>
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

  const labelRadius = RADIUS;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="nwspp-donut__svg">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#F3EFEA" strokeWidth={STROKE} />
      {arcs.map((arc, index) => {
        const midOffset = arc.offset + arc.length / 2;
        const angleDeg = (midOffset / CIRC) * 360 - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const lx = SIZE / 2 + labelRadius * Math.cos(angleRad);
        const ly = SIZE / 2 + labelRadius * Math.sin(angleRad);
        const showLabel = arc.percent >= 6;
        return (
          <g key={index}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(arc.length - 3, 0)} ${CIRC - arc.length + 3}`}
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
                fontSize="18"
                fontWeight="700"
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
