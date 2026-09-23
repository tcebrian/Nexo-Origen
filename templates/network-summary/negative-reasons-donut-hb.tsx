import type { NetworkSummaryReasonSegment } from "@/lib/reports/network-summary/types";

/** Paleta de motivos del informe de Grupo Hámbar: rojo, dorado, amarillo corporativo, gris, negro, burdeos. */
export const HB_REASON_PALETTE = ["#E50000", "#C67A00", "#E8C900", "#71808A", "#080808", "#8A2A24"];

/** Verde del anillo cuando no hay reseñas negativas. */
const EMPTY_RING = "#189B2B";

type Props = {
  segments: NetworkSummaryReasonSegment[];
};

const SIZE = 236;
const OUTER_RADIUS = SIZE / 2;
const INNER_RADIUS = 62;
const STROKE = OUTER_RADIUS - INNER_RADIUS;
const RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * Anillo del reparto de reseñas negativas. Sin negativas es un anillo verde
 * completo; con negativas, un arco por motivo real (mismos colores que la
 * tabla de motivos).
 */
export function NegativeReasonsDonutHb({ segments }: Props) {
  const arcs = segments.reduce<{ color: string; length: number; offset: number; percent: number }[]>(
    (acc, segment, index) => {
      const length = (segment.percent / 100) * CIRC;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
      acc.push({ color: HB_REASON_PALETTE[index % HB_REASON_PALETTE.length], length, offset, percent: segment.percent });
      return acc;
    },
    []
  );

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="nwshb-donut__svg" aria-hidden>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={arcs.length === 0 ? EMPTY_RING : "#EFE7DF"}
        strokeWidth={STROKE}
      />
      {arcs.map((arc, index) => {
        const midOffset = arc.offset + arc.length / 2;
        const angle = ((midOffset / CIRC) * 360 - 90) * (Math.PI / 180);
        const lx = SIZE / 2 + RADIUS * Math.cos(angle);
        const ly = SIZE / 2 + RADIUS * Math.sin(angle);
        const light = HB_REASON_PALETTE[index % HB_REASON_PALETTE.length] === "#E8C900";
        return (
          <g key={index}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(arc.length - (arcs.length > 1 ? 2 : 0), 0)} ${CIRC}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
            {arc.percent >= 8 ? (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={light ? "#171717" : "#fff"}
                fontSize="18"
                fontWeight="700"
                fontFamily="Inter, Arial, sans-serif"
              >
                {arc.percent.toFixed(0)}%
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
