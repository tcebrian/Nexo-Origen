"use client";

import type { RestaurantDetail } from "@/lib/restaurants/types";
import { detailKicker, detailSection, detailShell } from "./detail-health-styles";
import { RestaurantDayActivityChart } from "./restaurant-day-activity-chart";

type RestaurantDetailOverviewProps = {
  detail: RestaurantDetail;
  periodLabel: string;
};

function TrendBadge({ trend, change }: { trend: "up" | "down" | "flat"; change: string }) {
  const tone =
    trend === "up"
      ? "text-[var(--nexo-success)] bg-[var(--nexo-success-muted)] border-[var(--nexo-success-border)]"
      : trend === "down"
        ? "text-[var(--nexo-critical)] bg-[var(--nexo-critical-muted)] border-[var(--nexo-critical-border)]"
        : "text-[var(--nexo-text-secondary)] bg-[var(--nexo-inset)] border-[var(--nexo-border)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${tone}`}>
      {change === "0.00" ? "Sin cambio" : `${change} vs. periodo anterior`}
    </span>
  );
}

function StarDistributionChart({
  buckets,
  total,
}: {
  buckets: RestaurantDetail["periodBreakdown"]["starDistribution"];
  total: number;
}) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);

  if (total === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-[13px] text-[var(--nexo-text-tertiary)]">
        Sin reseñas en el periodo
      </p>
    );
  }

  return (
    <div className="flex h-[240px] items-end justify-between gap-3 px-1 pt-2">
      {buckets.map((bucket) => {
        const share = total > 0 ? Math.round((bucket.count / total) * 100) : 0;
        const barHeight = Math.round((bucket.count / max) * 168);
        const tone =
          bucket.stars >= 4
            ? "from-emerald-500/90 to-emerald-600/70"
            : bucket.stars === 3
              ? "from-amber-400/80 to-amber-500/60"
              : "from-red-500/85 to-red-600/70";

        return (
          <div key={bucket.stars} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="font-mono text-[12px] font-semibold tabular-nums text-[var(--nexo-text)]">
              {bucket.count}
            </span>
            <div className="flex h-[168px] w-full max-w-[52px] items-end justify-center">
              <div
                className={`w-full rounded-t-xl bg-gradient-to-t ${tone} shadow-[0_8px_24px_rgba(15,11,33,0.18)]`}
                style={{ height: `${bucket.count > 0 ? Math.max(barHeight, 10) : 4}px` }}
                title={`${bucket.count} reseñas (${share}%)`}
              />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-[var(--nexo-text)]">{bucket.stars} ★</p>
              <p className="text-[10px] text-[var(--nexo-text-tertiary)]">{share}%</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RestaurantDetailOverview({ detail, periodLabel }: RestaurantDetailOverviewProps) {
  const stats = detail.periodStats;
  const { starDistribution, dayBreakdown, dayBreakdownMode } = detail.periodBreakdown;

  return (
    <section className="space-y-6">
      <div className={`${detailShell} overflow-hidden`}>
        <div className={detailSection}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={detailKicker}>Resumen del periodo</p>
              <p className="mt-2 text-[14px] text-[var(--nexo-text-secondary)]">{periodLabel}</p>
            </div>
            <TrendBadge trend={stats.mediaTrend} change={stats.mediaChange} />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--nexo-border)] bg-gradient-to-br from-[var(--nexo-inset)] to-[var(--nexo-card)] px-5 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
                Media del periodo
              </p>
              <p className="mt-3 font-mono text-[42px] font-semibold leading-none tabular-nums text-[var(--nexo-text)]">
                {stats.periodMedia.toFixed(2)}
              </p>
              <p className="mt-3 text-[12px] text-[var(--nexo-text-secondary)]">
                {stats.periodReviews} reseña{stats.periodReviews === 1 ? "" : "s"} en total
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] px-5 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-success)]">
                Positivas
              </p>
              <p className="mt-3 font-mono text-[42px] font-semibold leading-none tabular-nums text-[var(--nexo-text)]">
                {stats.periodPositives}
              </p>
              <p className="mt-3 text-[12px] text-[var(--nexo-text-secondary)]">4 y 5 estrellas</p>
            </div>

            <div className="rounded-2xl border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-5 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-critical)]">
                Negativas
              </p>
              <p className="mt-3 font-mono text-[42px] font-semibold leading-none tabular-nums text-[var(--nexo-text)]">
                {stats.periodNegatives}
              </p>
              <p className="mt-3 text-[12px] text-[var(--nexo-text-secondary)]">1 y 2 estrellas</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`${detailShell} flex min-h-[360px] flex-col overflow-hidden`}>
        <div className={`${detailSection} flex flex-1 flex-col`}>
          <div className="mb-5">
            <p className={detailKicker}>Distribución por estrellas</p>
            <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">
              Cuántas reseñas de cada valoración ha recibido el local
            </p>
          </div>
          <StarDistributionChart buckets={starDistribution} total={stats.periodReviews} />
        </div>
      </div>

      <div className={`${detailShell} overflow-hidden`}>
        <div className={detailSection}>
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={detailKicker}>
                {dayBreakdownMode === "week" ? "Actividad diaria del periodo" : "Días con más reseñas"}
              </p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">
                {dayBreakdownMode === "week"
                  ? "Cada día muestra cuántas reseñas buenas y malas ha recibido el local en las fechas que has seleccionado."
                  : "Se muestran los 7 días del periodo con mayor volumen de reseñas, ordenados por fecha."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-3">
              <span className="inline-flex items-center gap-2.5 text-[13px] font-medium text-[var(--nexo-text-secondary)]">
                <span className="h-3.5 w-3.5 rounded-md bg-gradient-to-t from-emerald-700 to-emerald-500 shadow-[0_4px_12px_rgba(4,120,87,0.35)]" />
                Positivas
              </span>
              <span className="inline-flex items-center gap-2.5 text-[13px] font-medium text-[var(--nexo-text-secondary)]">
                <span className="h-3.5 w-3.5 rounded-md bg-gradient-to-t from-red-800 to-red-600 shadow-[0_4px_12px_rgba(185,28,28,0.35)]" />
                Negativas
              </span>
            </div>
          </div>

          <RestaurantDayActivityChart days={dayBreakdown} />
        </div>
      </div>
    </section>
  );
}
