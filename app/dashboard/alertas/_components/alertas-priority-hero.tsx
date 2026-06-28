"use client";

import { CommentExcerpt } from "@/app/dashboard/_components/comment-excerpt";
import { formatImpactRange, formatRelativeDetected, getAlertRecommendation, STATUS_META } from "@/lib/alerts/status";
import { getAlertMotiveLabel } from "@/lib/alerts/filters";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import { getReviewHrefFromAlertId } from "@/lib/text/excerpt";
import type { RestaurantAlert } from "@/lib/alerts/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { btnPrimary, incidentCard, insightBlock, metricPill, priorityBadge, textKicker } from "./ui/alertas-styles";

type AlertasPriorityHeroProps = {
  alert: RestaurantAlert;
  onSelect: (id: string) => void;
};

export function AlertasPriorityHero({ alert, onSelect }: AlertasPriorityHeroProps) {
  const meta = STATUS_META[alert.status];
  const impact = formatImpactSummary({
    mediaBefore: alert.mediaBefore,
    mediaAfter: alert.mediaAfter,
  });

  return (
    <section className={`${incidentCard} relative mb-8 overflow-hidden border-l-2 ${meta.cardEdge}`}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-violet-600/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <p className={textKicker}>Tu prioridad #1</p>
          {meta.priority !== "—" ? (
            <span className={`${priorityBadge} ${meta.priorityBadge}`}>{meta.priority}</span>
          ) : null}
          <span className={`${metricPill} ${meta.pill}`}>{meta.label}</span>
          <span className="text-[11px] text-[var(--nexo-text-tertiary)]">{formatRelativeDetected(alert.detectedAt)}</span>
        </div>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <RestaurantBrandLine
              brand={alert.brand}
              name={alert.restaurant}
              logoSize="md"
              nameClassName="text-[22px] font-semibold tracking-[-0.02em] text-[var(--nexo-text)] sm:text-[26px]"
            />

            <div className={`${insightBlock} mt-5 max-w-2xl`}>
              <p className={textKicker}>Qué dijo el cliente</p>
              <CommentExcerpt
                text={alert.whatHappened}
                reviewHref={getReviewHrefFromAlertId(alert.id) ?? undefined}
                maxLength={180}
                className="mt-2 text-[15px]"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3 py-1.5 text-[12px] text-[var(--nexo-text-secondary)]">
                Motivo: <span className="text-[var(--nexo-text)]">{getAlertMotiveLabel(alert)}</span>
              </span>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto lg:min-w-[220px]">
            <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-3">
              <p className={textKicker}>Media del local</p>
              <p className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-[var(--nexo-text)]">
                {formatImpactRange(alert)}
              </p>
              <p className={`mt-1 font-mono text-[14px] font-medium tabular-nums ${impactToneClass(impact.tone)}`}>
                {impact.delta} · {impact.subline}
              </p>
            </div>

            {getAlertRecommendation(alert) ? (
              <p className="text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
                {getAlertRecommendation(alert)}
              </p>
            ) : null}

            <button type="button" onClick={() => onSelect(alert.id)} className={`${btnPrimary} w-full`}>
              Ver expediente completo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
