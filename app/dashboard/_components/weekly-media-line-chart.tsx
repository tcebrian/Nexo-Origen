"use client";

const CHART = {
  line: "#A78BFA",
  grid: "rgba(255, 255, 255, 0.06)",
  label: "#6B7280",
  goal: "#34D399",
  volume: "rgba(167, 139, 250, 0.35)",
};

export type WeeklyChartPoint = {
  shortLabel: string;
  media: number;
  reviewCount: number;
};

type WeeklyMediaLineChartProps = {
  weeks: WeeklyChartPoint[];
  goalLine?: number;
  height?: number;
};

function buildRatingDomain(values: number[], goalLine?: number) {
  const active = values.filter((value) => Number.isFinite(value) && value > 0);
  if (active.length === 0) {
    return { minY: 1, maxY: 5 };
  }

  const dataMin = Math.min(...active, goalLine ?? active[0]);
  const dataMax = Math.max(...active, goalLine ?? active[0]);
  const padding = Math.max(0.2, (dataMax - dataMin) * 0.15);

  return {
    minY: Math.max(1, dataMin - padding),
    maxY: Math.min(5, dataMax + padding),
  };
}

export function WeeklyMediaLineChart({
  weeks,
  goalLine,
  height = 300,
}: WeeklyMediaLineChartProps) {
  const hasData = weeks.some((week) => week.reviewCount > 0);
  if (!hasData) return null;

  const width = Math.max(720, weeks.length * 64 + 96);
  const padding = { top: 28, right: 28, bottom: 44, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const volumeBand = 52;
  const innerHeight = height - padding.top - padding.bottom - volumeBand;
  const volumeTop = padding.top + innerHeight + 10;

  const { minY, maxY } = buildRatingDomain(
    weeks.map((week) => (week.reviewCount > 0 ? week.media : 0)),
    goalLine
  );
  const rangeY = maxY - minY || 0.5;
  const maxVolume = Math.max(...weeks.map((week) => week.reviewCount), 1);

  const coords = weeks.map((week, index) => {
    const x =
      padding.left +
      (weeks.length === 1 ? innerWidth / 2 : (index / (weeks.length - 1)) * innerWidth);
    const hasValue = week.reviewCount > 0;
    const y = hasValue
      ? padding.top + ((maxY - week.media) / rangeY) * innerHeight
      : null;
    const volumeHeight = (week.reviewCount / maxVolume) * (volumeBand - 8);
    return { x, y, week, hasValue, volumeHeight };
  });

  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of coords) {
    if (point.y !== null) {
      current.push({ x: point.x, y: point.y });
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);

  const areaSegments = segments.map((segment) => {
    if (segment.length < 2) return null;
    const line = segment.map((p) => `${p.x},${p.y}`).join(" ");
    const last = segment[segment.length - 1];
    const first = segment[0];
    const baseY = padding.top + innerHeight;
    return `${line} ${last.x},${baseY} ${first.x},${baseY}`;
  });

  const yTicks = Array.from({ length: 5 }, (_, index) => minY + (rangeY * index) / 4);
  const gradientId = `weekly-media-${height}-${weeks.length}`;

  return (
    <div className="relative h-full w-full overflow-x-auto overflow-y-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full min-w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Evolución semanal de la media de reseñas"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.line} stopOpacity="0.24" />
            <stop offset="100%" stopColor={CHART.line} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = padding.top + ((maxY - tick) / rangeY) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerWidth}
                y2={y}
                stroke={CHART.grid}
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fill={CHART.label}
                fontSize="11"
                fontFamily="var(--font-geist-mono)"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {goalLine !== undefined && (
          <>
            <line
              x1={padding.left}
              y1={padding.top + ((maxY - goalLine) / rangeY) * innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + ((maxY - goalLine) / rangeY) * innerHeight}
              stroke={CHART.goal}
              strokeWidth="1.5"
              strokeDasharray="6 5"
              opacity="0.85"
            />
            <text
              x={padding.left + innerWidth}
              y={padding.top + ((maxY - goalLine) / rangeY) * innerHeight - 8}
              textAnchor="end"
              fill={CHART.goal}
              fontSize="10"
              fontWeight="600"
            >
              Objetivo {goalLine.toFixed(1)}
            </text>
          </>
        )}

        {coords.map((point) => {
          if (point.volumeHeight <= 0) return null;
          const barWidth = Math.min(28, innerWidth / Math.max(weeks.length, 1) - 10);
          return (
            <rect
              key={`vol-${point.week.shortLabel}`}
              x={point.x - barWidth / 2}
              y={volumeTop + (volumeBand - 8) - point.volumeHeight}
              width={barWidth}
              height={point.volumeHeight}
              rx="3"
              fill={CHART.volume}
            />
          );
        })}

        {areaSegments.map((points, index) =>
          points ? <polygon key={`area-${index}`} points={points} fill={`url(#${gradientId})`} /> : null
        )}

        {segments.map((segment, index) =>
          segment.length >= 2 ? (
            <polyline
              key={`line-${index}`}
              points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={CHART.line}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null
        )}

        {coords.map((point) => {
          if (!point.hasValue || point.y === null) return null;
          return (
            <g key={`dot-${point.week.shortLabel}`}>
              <circle cx={point.x} cy={point.y} r="9" fill={CHART.line} opacity="0.14" />
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#FFFFFF"
                stroke={CHART.line}
                strokeWidth="2.5"
              />
              <text
                x={point.x}
                y={point.y - 14}
                textAnchor="middle"
                fill="#E5E7EB"
                fontSize="11"
                fontWeight="600"
                fontFamily="var(--font-geist-mono)"
              >
                {point.week.media.toFixed(2)}
              </text>
            </g>
          );
        })}

        {coords.map((point, index) => {
          if (weeks.length > 10 && index % 2 !== 0 && index !== weeks.length - 1) {
            return null;
          }
          return (
            <text
              key={`label-${point.week.shortLabel}`}
              x={point.x}
              y={height - 12}
              fill={CHART.label}
              fontSize="10"
              textAnchor="middle"
            >
              {point.week.shortLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
