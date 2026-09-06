import type { NetworkSummaryReasonSegment } from "@/lib/reports/network-summary/types";

/** Rojo Tim Hortons → marrón caramelo — exactamente los dos tonos de marca del spec. */
const PALETTE = ["#CC0008", "#A86A2E", "#E39113", "#08712F", "#4E4641", "#D30B16"];

type Props = {
  segments: NetworkSummaryReasonSegment[];
};

const SIZE = 238;
// Agujero central ~80px de diámetro sobre 238px total, como pide el spec.
const OUTER_RADIUS = SIZE / 2;
const INNER_RADIUS = 40;
const STROKE = OUTER_RADIUS - INNER_RADIUS;
const RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function NegativeReasonsDonutTh({ segments }: Props) {
  if (segments.length === 0) return null;

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
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="nwsth-donut__svg">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#F1E4D9" strokeWidth={STROKE} />
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
                fontSize="21"
                fontWeight="700"
                fontFamily="'Roboto Condensed', sans-serif"
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
