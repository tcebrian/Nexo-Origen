"use client";

import Link from "next/link";
import { StackedSentimentBar } from "@/app/dashboard/_components/charts";
import { buildExecutiveSnapshot } from "@/lib/restaurants/executive-insights";
import { getTargetProgress } from "@/lib/restaurants/reputation-math";
import {
  ACTION_PRIORITY_CLASS,
  ACTION_PRIORITY_LABEL,
  formatNegativesTolerance,
  formatPositivesNeeded,
  getReputationOutlook,
} from "@/lib/restaurants/reputation-outlook";
import type { RestaurantDetail } from "@/lib/restaurants/types";
import { btnGhost, statusPill } from "../../_components/ui/restaurantes-styles";
import {
  detailExecutiveCard,
  detailExecutiveMetric,
  detailKicker,
  detailSection,
  healthStyles,
} from "./detail-health-styles";

type RestaurantDetailExecutiveProps = {
  detail: RestaurantDetail;
};

export function RestaurantDetailExecutive({ detail }: RestaurantDetailExecutiveProps) {
  const outlook = getReputationOutlook(
    detail.currentMedia,
    detail.totalReviews,
    detail.status,
    detail.targetMedia
  );
  const snapshot = buildExecutiveSnapshot(detail, outlook);
  const health = healthStyles[detail.healthStatus];
  const progress = getTargetProgress(detail.currentMedia, detail.targetMedia);
  const stats = detail.periodStats;

  return (
    <section className={`${detailExecutiveCard} mb-8`}>
      <div className={`${detailSection} relative`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--nexo-accent)]/60 via-violet-400/30 to-transparent" />

        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className={detailKicker}>Resumen ejecutivo</p>
            <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[26px]">
              {snapshot.headline}
            </h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--nexo-text-secondary)]">
              {snapshot.narrative}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${statusPill[detail.status]}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                {detail.statusLabel}
              </span>
              <span
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${ACTION_PRIORITY_CLASS[outlook.actionPriority]}`}
              >
                Prioridad {ACTION_PRIORITY_LABEL[outlook.actionPriority]}
              </span>
              {detail.activeAlerts > 0 && (
                <span className="rounded-lg border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-3 py-1.5 text-[11px] font-medium text-[var(--nexo-critical)]">
                  {detail.activeAlerts} alerta{detail.activeAlerts === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <div className="w-full shrink-0 xl:w-[340px]">
            <div className="rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] p-5">
              <p className={detailKicker}>Acción inmediata</p>
              <p className={`mt-3 text-[17px] font-medium leading-snug ${health.text}`}>
                {detail.primaryAction}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
                    Necesita
                  </p>
                  <p className="mt-1 font-mono text-[20px] font-semibold text-[var(--nexo-accent)]">
                    {formatPositivesNeeded(outlook.positivesNeeded)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
                    Soporta
                  </p>
                  <p className="mt-1 font-mono text-[20px] font-semibold text-[var(--nexo-success)]">
                    {formatNegativesTolerance(outlook.negativesTolerance)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={detail.reviewsHref} className={`${btnGhost} text-[11px]`}>
                  Reseñas
                </Link>
                <Link href={detail.preventHref} className={`${btnGhost} text-[11px]`}>
                  Nexo Prevent
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            { label: "Media global", value: detail.currentMedia.toFixed(2), sub: `Obj. ${detail.targetMedia.toFixed(1)}` },
            { label: "Media periodo", value: stats.periodMedia.toFixed(2), sub: stats.mediaChange },
            { label: "Progreso meta", value: `${progress}%`, sub: snapshot.onTarget ? "En objetivo" : "Por recuperar" },
            { label: "Protección", value: `${detail.protectionLevel}%`, sub: detail.statusLabel },
            { label: "Reseñas hist.", value: String(detail.totalReviews), sub: `${detail.positiveReviews}+ / ${detail.negativeReviews}−` },
            { label: "Periodo", value: String(stats.periodReviews), sub: `${stats.periodPositives}+ · ${stats.periodNegatives}−` },
            { label: "Satisfacción", value: `${snapshot.periodSatisfactionPct}%`, sub: "En el periodo" },
            { label: "NPS periodo", value: stats.periodReviews > 0 ? String(stats.nps) : "—", sub: "Promotores − detractores" },
          ].map((metric) => (
            <div key={metric.label} className={detailExecutiveMetric}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
                {metric.label}
              </p>
              <p className="mt-2 font-mono text-[22px] font-semibold tabular-nums leading-none text-[var(--nexo-text)]">
                {metric.value}
              </p>
              <p className="mt-1.5 text-[10px] text-[var(--nexo-text-tertiary)]">{metric.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] p-5">
            <p className={detailKicker}>Sentimiento histórico</p>
            <div className="mt-4">
              <StackedSentimentBar
                positives={detail.positiveReviews}
                neutrals={Math.max(0, detail.totalReviews - detail.positiveReviews - detail.negativeReviews)}
                negatives={detail.negativeReviews}
              />
            </div>
            <p className="mt-3 text-[12px] text-[var(--nexo-text-secondary)]">
              {snapshot.satisfactionPct}% de reseñas positivas sobre el total acumulado.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] p-5">
            <p className={detailKicker}>Sentimiento del periodo</p>
            <div className="mt-4">
              <StackedSentimentBar
                positives={stats.periodPositives}
                neutrals={Math.max(0, stats.periodReviews - stats.periodPositives - stats.periodNegatives)}
                negatives={stats.periodNegatives}
              />
            </div>
            <p className="mt-3 text-[12px] text-[var(--nexo-text-secondary)]">
              {stats.periodReviews} reseñas analizadas · variación media {stats.mediaChange}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
