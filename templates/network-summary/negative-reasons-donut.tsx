import type { NetworkSummaryReasonSegment } from "@/lib/reports/network-summary/types";

const PALETTE = ["#c0392b", "#d9531e", "#d99a1f", "#8a6d3b", "#5c5c5c", "#3f8f4a"];

type Props = {
  segments: NetworkSummaryReasonSegment[];
  accent: string;
};

const SIZE = 253;
const STROKE = 39;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function NegativeReasonsDonut({ segments, accent }: Props) {
  if (segments.length === 0) {
    return (
      <div className="nws-donut-empty">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke={accent} strokeWidth="1.4" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          <path d="M9 10h.01M15 10h.01M9 15c.7-1 2.3-1 3 0" />
        </svg>
        <p>Sin reseñas negativas en este periodo</p>
      </div>
    );
  }

  const arcs = segments.reduce<{ color: string; length: number; offset: number }[]>((acc, segment, index) => {
    const length = (segment.percent / 100) * CIRC;
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
    acc.push({ color: PALETTE[index % PALETTE.length], length, offset });
    return acc;
  }, []);

  return (
    <div className="nws-donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="nws-donut__svg">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#eee6d8" strokeWidth={STROKE} />
        {arcs.map((arc, index) => (
          <circle
            key={index}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.length} ${CIRC - arc.length}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        ))}
      </svg>
      <ul className="nws-donut__legend">
        {segments.map((segment, index) => (
          <li key={segment.label}>
            <span className="nws-donut__swatch" style={{ background: PALETTE[index % PALETTE.length] }} aria-hidden />
            <span className="nws-donut__legend-label">{segment.label}</span>
            <span className="nws-donut__legend-value">
              {segment.count} ({segment.percent.toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
