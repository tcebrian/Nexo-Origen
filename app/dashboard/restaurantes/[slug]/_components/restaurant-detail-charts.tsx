"use client";

import {
  DonutChart,
  HorizontalBarChart,
  LineChart,
  StackedVolumeBarChart,
} from "@/app/dashboard/_components/charts";
import {
  ACTION_PRIORITY_CLASS,
  ACTION_PRIORITY_LABEL,
  type ActionPriority,
} from "@/lib/restaurants/reputation-outlook";
import type { DetectedIssue, RestaurantVolumePoint } from "@/lib/restaurants/types";
import {
  detailChartCard,
  detailChartFrame,
  detailChartFrameInner,
  detailKicker,
  detailSection,
  detailSectionTitle,
  detailStatTile,
} from "./detail-health-styles";

const ISSUE_COLORS = ["#A78BFA", "#F472B6", "#FBBF24", "#34D399", "#94A3B8"];
const CHART_H = 320;

function ChartHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-[var(--nexo-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className={detailKicker}>{title}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">{subtitle}</p>
      </div>
      {children ? <div className="flex shrink-0 flex-wrap gap-2.5">{children}</div> : null}
    </div>
  );
}

function StatBox({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "accent" | "critical" | "watch";
}) {
  const toneClass = {
    neutral: "text-[var(--nexo-text)]",
    success: "text-[var(--nexo-success)]",
    accent: "text-[var(--nexo-accent)]",
    critical: "text-[var(--nexo-critical)]",
    watch: "text-[var(--nexo-watch)]",
  }[tone];

  return (
    <div className={`${detailStatTile} min-w-[96px]`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
        {label}
      </p>
      <p className={`mt-1.5 font-mono text-[24px] font-semibold tabular-nums leading-none ${toneClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[10px] text-[var(--nexo-text-tertiary)]">{hint}</p> : null}
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[var(--nexo-border)] pt-4 text-[11px] text-[var(--nexo-text-secondary)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          {item.dashed ? (
            <span className="h-0 w-5 border-t border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

type ReputationChartProps = {
  labels: string[];
  values: number[];
  target: number;
  periodMedia: number;
  mediaChange: string;
  mediaTrend: "up" | "down" | "flat";
  globalMedia: number;
};

export function ReputationLineChart({
  labels,
  values,
  target,
  periodMedia,
  mediaChange,
  mediaTrend,
  globalMedia,
}: ReputationChartProps) {
  const trendColor =
    mediaTrend === "up"
      ? "text-[var(--nexo-success)]"
      : mediaTrend === "down"
        ? "text-[var(--nexo-critical)]"
        : "text-[var(--nexo-text-tertiary)]";
  const trendLabel = mediaTrend === "flat" ? "Estable" : mediaChange;
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 0;
  const gap = Math.max(0, target - globalMedia);

  return (
    <section className={detailChartCard}>
      <div className={`${detailSection} flex flex-1 flex-col`}>
        <ChartHeader
          title="Evolución de reputación"
          subtitle="Trayectoria diaria de la media en el periodo. La línea verde marca el objetivo de red."
        >
          <StatBox label="Media periodo" value={periodMedia.toFixed(2)} hint={`Global ${globalMedia.toFixed(2)}`} />
          <StatBox label="Variación" value={trendLabel} tone={mediaTrend === "up" ? "success" : mediaTrend === "down" ? "critical" : "neutral"} />
          <StatBox label="Brecha" value={gap > 0 ? gap.toFixed(2) : "—"} hint={`Objetivo ${target.toFixed(1)}`} tone={gap > 0 ? "watch" : "success"} />
        </ChartHeader>

        <div className={`mt-6 ${detailChartFrame}`}>
          <div className={detailChartFrameInner}>
            {values.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--nexo-text-tertiary)]">
                Sin evolución en el periodo seleccionado
              </div>
            ) : (
              <LineChart values={values} labels={labels} height={CHART_H} goalLine={target} />
            )}
          </div>
        </div>

        {values.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Mínimo periodo", value: minVal.toFixed(2) },
              { label: "Máximo periodo", value: maxVal.toFixed(2) },
              { label: "Objetivo red", value: target.toFixed(1) },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">{row.label}</p>
                <p className="mt-1 font-mono text-[15px] font-semibold text-[var(--nexo-text)]">{row.value}</p>
              </div>
            ))}
          </div>
        )}

        <ChartLegend
          items={[
            { color: "#A78BFA", label: "Media diaria" },
            { color: "#34D399", label: `Objetivo ${target.toFixed(1)}`, dashed: true },
          ]}
        />
        <p className={`mt-2 text-[11px] font-medium ${trendColor}`}>
          {mediaTrend === "flat" ? "Sin variación relevante en el periodo." : `Tendencia ${mediaTrend === "up" ? "alcista" : "bajista"}: ${mediaChange} vs. inicio del periodo.`}
        </p>
      </div>
    </section>
  );
}

type ReviewVolumeChartProps = {
  series: RestaurantVolumePoint[];
  totalReviews: number;
  totalPositives: number;
  totalNegatives: number;
};

export function ReviewVolumeChart({
  series,
  totalReviews,
  totalPositives,
  totalNegatives,
}: ReviewVolumeChartProps) {
  const satisfactionPct = totalReviews > 0 ? Math.round((totalPositives / totalReviews) * 100) : 0;
  const negativePct = totalReviews > 0 ? Math.round((totalNegatives / totalReviews) * 100) : 0;
  const peakDay = series.reduce(
    (best, point) => {
      const total = point.positive + point.negative;
      return total > best.total ? { label: point.label, total } : best;
    },
    { label: "—", total: 0 }
  );

  return (
    <section className={detailChartCard}>
      <div className={`${detailSection} flex flex-1 flex-col`}>
        <ChartHeader
          title="Volumen y sentimiento"
          subtitle="Desglose diario de reseñas positivas y negativas captadas en el periodo."
        >
          <StatBox label="Total" value={String(totalReviews)} />
          <StatBox label="Positivas" value={String(totalPositives)} hint={`${satisfactionPct}%`} tone="success" />
          <StatBox label="Negativas" value={String(totalNegatives)} hint={`${negativePct}%`} tone="critical" />
        </ChartHeader>

        <div className={`mt-6 ${detailChartFrame}`}>
          <div className={`${detailChartFrameInner} px-2 py-2`}>
            <StackedVolumeBarChart series={series} height={CHART_H - 16} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">Día pico</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--nexo-text)]">{peakDay.label}</p>
            <p className="text-[10px] text-[var(--nexo-text-tertiary)]">{peakDay.total} reseñas</p>
          </div>
          <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">Ratio pos/neg</p>
            <p className="mt-1 font-mono text-[15px] font-semibold text-[var(--nexo-text)]">
              {totalNegatives > 0 ? (totalPositives / totalNegatives).toFixed(1) : totalPositives > 0 ? "∞" : "—"} : 1
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3 py-2.5 sm:col-span-1">
            <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">Satisfacción</p>
            <p className="mt-1 font-mono text-[15px] font-semibold text-[var(--nexo-success)]">{satisfactionPct}%</p>
          </div>
        </div>

        <ChartLegend
          items={[
            { color: "#047857", label: "Positivas" },
            { color: "#B91C1C", label: "Negativas" },
          ]}
        />
      </div>
    </section>
  );
}

type SentimentDonutProps = {
  positives: number;
  negatives: number;
  neutrals: number;
  title: string;
};

export function SentimentDonutCard({ positives, negatives, neutrals, title }: SentimentDonutProps) {
  const total = positives + negatives + neutrals;

  return (
    <section className={detailChartCard}>
      <div className={`${detailSection} flex flex-1 flex-col`}>
        <ChartHeader title={title} subtitle="Composición del volumen de opiniones en el periodo." />

        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-8 sm:flex-row sm:items-center sm:justify-between">
          <DonutChart
            size={180}
            centerValue={String(total)}
            centerSub="reseñas"
            centerVariant="hub"
            segments={[
              { value: positives, color: "#047857", label: "Positivas" },
              { value: negatives, color: "#B91C1C", label: "Negativas" },
              { value: neutrals, color: "#6B7280", label: "Neutras" },
            ]}
          />
          <div className="w-full min-w-0 flex-1 space-y-4">
            {[
              { label: "Positivas", value: positives, color: "#047857", pct: total > 0 ? Math.round((positives / total) * 100) : 0 },
              { label: "Negativas", value: negatives, color: "#B91C1C", pct: total > 0 ? Math.round((negatives / total) * 100) : 0 },
              { label: "Neutras", value: neutrals, color: "#6B7280", pct: total > 0 ? Math.round((neutrals / total) * 100) : 0 },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 text-[var(--nexo-text-secondary)]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.label}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--nexo-text)]">
                    {row.value} <span className="text-[var(--nexo-text-tertiary)]">({row.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--nexo-inset)]">
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

type IssuesChartProps = {
  issues: DetectedIssue[];
  negativeCount: number;
  recommendedAction: string;
  actionPriority: ActionPriority;
};

export function IssuesBreakdownChart({
  issues,
  negativeCount,
  recommendedAction,
  actionPriority,
}: IssuesChartProps) {
  const segments = issues.map((issue, i) => ({
    value: issue.intensity,
    color: ISSUE_COLORS[i % ISSUE_COLORS.length],
    label: issue.label,
  }));

  const topIssue = issues[0];

  return (
    <section className={detailChartCard}>
      <div className={`${detailSection} flex flex-1 flex-col`}>
        <ChartHeader
          title="Motivos de insatisfacción"
          subtitle="Causas detectadas en reseñas negativas. Priorizar el motivo dominante en la acción operativa."
        >
          <StatBox label="Negativas" value={String(negativeCount)} tone="critical" />
          {topIssue ? (
            <StatBox label="Principal" value={`${topIssue.intensity}%`} hint={topIssue.label} tone="watch" />
          ) : null}
        </ChartHeader>

        {issues.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <p className="text-[15px] font-medium text-[var(--nexo-text)]">Sin fricciones detectadas</p>
            <p className="mt-2 max-w-sm text-[13px] text-[var(--nexo-text-secondary)]">
              No hay categorías de insatisfacción en el periodo. El local no acumula reseñas negativas analizables.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-1 flex-col gap-8 xl:flex-row xl:items-center">
            <div className="flex shrink-0 justify-center xl:justify-start">
              <DonutChart
                size={176}
                centerValue={String(negativeCount)}
                centerSub="negativas"
                centerVariant="hub"
                segments={segments}
              />
            </div>
            <div className="min-w-0 flex-1">
              <HorizontalBarChart
                items={issues.map((issue, i) => ({
                  label: issue.label,
                  value: issue.intensity,
                  color: ISSUE_COLORS[i % ISSUE_COLORS.length],
                }))}
              />
            </div>
          </div>
        )}

        <div className="mt-auto rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-5 py-4">
          <p className={detailKicker}>Decisión recomendada</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--nexo-text)]">{recommendedAction}</p>
          <p
            className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] ${ACTION_PRIORITY_CLASS[actionPriority]}`}
          >
            Prioridad {ACTION_PRIORITY_LABEL[actionPriority]}
          </p>
        </div>
      </div>
    </section>
  );
}

export function RestaurantAnalyticsSection({ title }: { title?: string }) {
  return (
    <p className={`mb-5 ${detailSectionTitle}`}>{title ?? "Analítica del periodo"}</p>
  );
}
