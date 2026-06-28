"use client";

import { ensureChartPoints } from "@/lib/chart-utils";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { CHART_DRAW_MS } from "./motion/motion-config";
import { usePrefersReducedMotion } from "./motion/use-prefers-reduced-motion";

const MotionPolyline = motion.polyline;

const CHART = {
  line: "#A78BFA",
  fill: "rgba(124, 58, 237, 0.16)",
  grid: "rgba(255, 255, 255, 0.06)",
  label: "#6B7280",
  goal: "#34D399",
  empty: "#6B7280",
};

type LineChartProps = {
  values: number[];
  labels: string[];
  height?: number;
  goalLine?: number;
  accentColor?: string;
  highlightIndices?: number[];
};

export function LineChart({
  values,
  labels,
  height = 260,
  goalLine,
  accentColor = CHART.line,
  highlightIndices,
}: LineChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const lineAnimation = useMemo(
    () =>
      reducedMotion
        ? {}
        : {
            initial: { pathLength: 0, opacity: 0.65 },
            animate: { pathLength: 1, opacity: 1 },
            transition: { duration: CHART_DRAW_MS / 1000, ease: "easeOut" as const },
          },
    [reducedMotion]
  );

  if (values.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-sm text-gray-500"
        style={{ height }}
      >
        Pendiente de activar
      </div>
    );
  }

  const normalized = ensureChartPoints(values, labels);
  const chartValues = normalized.values;
  const chartLabels = normalized.labels;

  const width = 900;
  const padding = { top: 24, right: 24, bottom: 32, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const minY = Math.min(...chartValues, goalLine ?? chartValues[0]) - 0.1;
  const maxY = Math.max(...chartValues, goalLine ?? chartValues[0]) + 0.1;
  const rangeY = maxY - minY || 1;

  const coords = chartValues.map((value, index) => {
    const x = padding.left + (index / Math.max(chartValues.length - 1, 1)) * innerWidth;
    const y = padding.top + ((maxY - value) / rangeY) * innerHeight;
    return { x, y, value };
  });

  const linePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${linePoints} ${padding.left + innerWidth},${padding.top + innerHeight} ${padding.left},${padding.top + innerHeight}`;
  const goalY =
    goalLine !== undefined ? padding.top + ((maxY - goalLine) / rangeY) * innerHeight : null;

  const highlights = new Set(
    highlightIndices ?? [chartValues.length - 1].filter((i) => i >= 0)
  );

  const yTicks = [0, 1, 2, 3, 4].map((i) => maxY - (rangeY * i) / 4);
  const gradientId = `nexo-area-${height}-${chartValues.length}`;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => {
          const y = padding.top + (i / 4) * innerHeight;
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
              <text x={6} y={y + 4} fill={CHART.label} fontSize="10" fontFamily="var(--font-geist-mono)">
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {goalY !== null && goalLine !== undefined && (
          <>
            <line
              x1={padding.left}
              y1={goalY}
              x2={padding.left + innerWidth}
              y2={goalY}
              stroke={CHART.goal}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.7"
            />
            <text
              x={padding.left + innerWidth - 4}
              y={goalY - 6}
              fill={CHART.goal}
              fontSize="9"
              textAnchor="end"
              fontWeight="600"
            >
              Objetivo {goalLine.toFixed(2)}
            </text>
          </>
        )}

        <polygon points={areaPoints} fill={`url(#${gradientId})`} opacity={reducedMotion ? 1 : undefined} />
        <MotionPolyline
          points={linePoints}
          fill="none"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...lineAnimation}
        />

        {coords.map((point, index) => {
          if (!highlights.has(index)) return null;
          return (
            <g key={index}>
              <circle cx={point.x} cy={point.y} r="7" fill={accentColor} opacity="0.15" />
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth="2.5"
              />
            </g>
          );
        })}

        {chartLabels.map((label, index) => {
          if (chartLabels.length > 8 && index % 2 !== 0 && index !== chartLabels.length - 1) {
            return null;
          }
          const x = padding.left + (index / Math.max(chartLabels.length - 1, 1)) * innerWidth;
          return (
            <text
              key={`${label}-${index}`}
              x={x}
              y={height - 8}
              fill={CHART.label}
              fontSize="10"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function MiniSparkline({
  values,
  color = CHART.line,
  height = 36,
  width = 80,
  filled = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
  filled?: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  if (values.length < 2) {
    return (
      <div
        className="rounded-md bg-[var(--nexo-inset)]"
        style={{ width, height }}
        aria-hidden
      />
    );
  }

  const pad = 3;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 0.01;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + ((max - v) / span) * (height - pad * 2);
    return `${x},${y}`;
  });

  const line = points.join(" ");
  const area = `${line} ${width - pad},${height - pad} ${pad},${height - pad}`;
  const lastPoint = points[points.length - 1]?.split(",") ?? [];
  const tooltipValue = hoverIndex !== null ? values[hoverIndex] : values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className="group/spark"
      onMouseLeave={() => setHoverIndex(null)}
    >
      {filled && <polygon points={area} fill={`${color}18`} />}
      <MotionPolyline
        points={line}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={reducedMotion ? undefined : "nexo-sparkline-line"}
        style={
          reducedMotion
            ? undefined
            : ({ ["--spark-path-length" as string]: String(width * 1.4) } as React.CSSProperties)
        }
        {...(reducedMotion
          ? {}
          : {
              initial: { pathLength: 0 },
              animate: { pathLength: 1 },
              transition: { duration: 0.7, ease: "easeOut" },
            })}
      />
      {lastPoint.length === 2 ? (
        <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.5" fill="#fff" stroke={color} strokeWidth="1.5" />
      ) : null}
      {points.map((point, index) => {
        const [x, y] = point.split(",");
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="6"
            fill="transparent"
            onMouseEnter={() => setHoverIndex(index)}
          />
        );
      })}
      {hoverIndex !== null ? (
        <title>{tooltipValue.toFixed(2)}</title>
      ) : null}
    </svg>
  );
}

export function StackedSentimentBar({
  positives,
  neutrals,
  negatives,
  className = "",
  showLegend = true,
}: {
  positives: number;
  neutrals: number;
  negatives: number;
  className?: string;
  showLegend?: boolean;
}) {
  const total = positives + neutrals + negatives;
  if (total === 0) {
    return <div className={`h-2.5 rounded-full bg-[var(--nexo-inset)] ${className}`} />;
  }

  const posPct = Math.round((positives / total) * 100);
  const neuPct = Math.round((neutrals / total) * 100);
  const negPct = 100 - posPct - neuPct;

  return (
    <div className={className}>
      {showLegend && (
        <div className="mb-2 flex justify-between text-[10px] font-medium uppercase tracking-wide">
          <span className="text-[var(--nexo-success)]">Positivas {positives}</span>
          <span className="text-[var(--nexo-critical)]">Negativas {negatives}</span>
        </div>
      )}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--nexo-inset)]">
        <div className="bg-[var(--nexo-success)]" style={{ width: `${posPct}%` }} />
        <div className="bg-[var(--nexo-watch)] opacity-80" style={{ width: `${neuPct}%` }} />
        <div className="bg-[var(--nexo-critical)]" style={{ width: `${negPct}%` }} />
      </div>
      {showLegend && (
        <p className="mt-1.5 text-right text-[10px] text-[var(--nexo-text-tertiary)]">
          {posPct}% satisfacción
        </p>
      )}
    </div>
  );
}

type DonutSegment = { value: number; color: string; label?: string };

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  centerSub?: string;
  centerValue?: string;
  centerVariant?: "hub" | "metric";
};

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({
  segments,
  size = 140,
  centerSub,
  centerValue,
  centerVariant = "metric",
}: DonutChartProps) {
  if (segments.length === 0 || segments.every((s) => s.value === 0)) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-inset)] text-[10px] text-[var(--nexo-text-tertiary)]"
        style={{ width: size, height: size }}
      >
        Sin datos
      </div>
    );
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = size * 0.3;
  const gapDeg = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;

  const slices = segments
    .filter((s) => s.value > 0)
    .reduce<
      { cursor: number; slices: Array<(typeof segments)[number] & { start: number; end: number; index: number }> }
    >(
      (acc, segment, index) => {
        const sweep = (segment.value / total) * 360 - gapDeg;
        const start = acc.cursor + gapDeg / 2;
        const end = start + sweep;
        return {
          cursor: end + gapDeg / 2,
          slices: [...acc.slices, { ...segment, start, end, index }],
        };
      },
      { cursor: -90, slices: [] }
    ).slices;

  const displayValue =
    centerValue ??
    (centerVariant === "metric"
      ? String(Math.round((slices[0]?.value / total) * 100) || 0)
      : undefined);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {slices.map((slice) => (
          <path
            key={slice.index}
            d={donutSlicePath(cx, cy, outerR, innerR, slice.start, slice.end)}
            fill={slice.color}
          />
        ))}
        <circle cx={cx} cy={cy} r={innerR - 1} fill="var(--nexo-card)" />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {displayValue && (
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--nexo-text)]">
            {displayValue}
            {centerVariant === "metric" && !centerValue ? "%" : ""}
          </p>
        )}
        {centerSub && (
          <p className="mt-0.5 max-w-[80px] text-[9px] font-semibold uppercase tracking-wider text-[var(--nexo-text-tertiary)]">
            {centerSub}
          </p>
        )}
      </div>
    </div>
  );
}

type VolumeBarPoint = { label: string; positive: number; negative: number };

export function StackedVolumeBarChart({
  series,
  height = 280,
}: {
  series: VolumeBarPoint[];
  height?: number;
}) {
  if (series.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-[13px] text-[var(--nexo-text-tertiary)]"
        style={{ minHeight: height }}
      >
        Sin datos en el periodo
      </div>
    );
  }

  const width = 720;
  const padding = { top: 20, right: 20, bottom: 40, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxTotal = Math.max(...series.map((s) => s.positive + s.negative), 1);
  const barGap = 10;
  const barW = Math.min(52, Math.max(14, (innerW - barGap * (series.length - 1)) / series.length));
  const chartW = padding.left + series.length * (barW + barGap) + padding.right;
  const yTicks = [0, Math.ceil(maxTotal / 2), maxTotal];

  return (
    <svg
      viewBox={`0 0 ${Math.max(width, chartW)} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Volumen de reseñas por tramo"
    >
      {yTicks.map((tick) => {
        const y = padding.top + innerH - (tick / maxTotal) * innerH;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y}
              x2={Math.max(width, chartW) - padding.right}
              y2={y}
              stroke={CHART.grid}
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fill={CHART.label}
              fontSize="10"
              fontFamily="var(--font-geist-mono)"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {series.map((point, i) => {
        const x = padding.left + i * (barW + barGap);
        const total = point.positive + point.negative;
        const totalH = (total / maxTotal) * innerH;
        const negH = (point.negative / maxTotal) * innerH;
        const posH = Math.max(0, totalH - negH);
        const baseY = padding.top + innerH;

        return (
          <g key={`${point.label}-${i}`}>
            {posH > 0 && (
              <rect
                x={x}
                y={baseY - posH}
                width={barW}
                height={posH}
                rx="4"
                fill="#047857"
                className="nexo-chart-bar"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            )}
            {negH > 0 && (
              <rect
                x={x}
                y={baseY - totalH}
                width={barW}
                height={negH}
                rx="4"
                fill="#B91C1C"
                className="nexo-chart-bar"
                style={{ animationDelay: `${i * 0.05 + 0.03}s` }}
              />
            )}
            {total > 0 && (
              <text
                x={x + barW / 2}
                y={baseY - totalH - 6}
                textAnchor="middle"
                fill={CHART.label}
                fontSize="9"
                fontFamily="var(--font-geist-mono)"
              >
                {total}
              </text>
            )}
            {(series.length <= 8 || i % 2 === 0 || i === series.length - 1) && (
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                fill={CHART.label}
                fontSize="9"
              >
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const BAR_COLORS = ["#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD"];

export function HorizontalBarChart({
  items,
}: {
  items: { label: string; value: number; max?: number; color?: string }[];
}) {
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1);

  return (
    <div className="space-y-3.5">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-[var(--nexo-text-secondary)]">{item.label}</span>
            <span className="shrink-0 font-mono tabular-nums text-[var(--nexo-text)]">
              {item.value}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--nexo-inset)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color ?? BAR_COLORS[index % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HealthDonut({
  onTarget,
  onWatch,
  critical,
  size = 148,
}: {
  onTarget: number;
  onWatch: number;
  critical: number;
  size?: number;
}) {
  const total = onTarget + onWatch + critical;
  return (
    <div className="flex items-center gap-5">
      <DonutChart
        size={size}
        centerVariant="metric"
        centerValue={String(total)}
        centerSub="Locales"
        segments={[
          { value: onTarget, color: "#047857", label: "En objetivo" },
          { value: onWatch, color: "#B45309", label: "Vigilancia" },
          { value: critical, color: "#B91C1C", label: "Críticos" },
        ]}
      />
      <div className="space-y-2 text-xs">
        {[
          { label: "En objetivo", value: onTarget, color: "#047857" },
          { label: "Vigilancia", value: onWatch, color: "#B45309" },
          { label: "Críticos", value: critical, color: "#B91C1C" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="text-[var(--nexo-text-secondary)]">{row.label}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-[var(--nexo-text)]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
