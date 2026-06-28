"use client";

import { CommentExcerpt } from "@/app/dashboard/_components/comment-excerpt";
import { formatImpactRange, STATUS_META } from "@/lib/alerts/status";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import { getReviewHrefFromAlertId } from "@/lib/text/excerpt";
import type { RestaurantAlert } from "@/lib/alerts/types";
import { StaggerItem, StaggerList } from "../../_components/motion/stagger";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import {
  btnPrimary,
  incidentCard,
  incidentCardActive,
  incidentCardHover,
  insightBlock,
  metricPill,
  priorityBadge,
  sectionPad,
  textKicker,
  textSectionTitle,
} from "./ui/alertas-styles";

type AlertasUrgentCardsProps = {
  alerts: RestaurantAlert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function AlertasUrgentCards({ alerts, selectedId, onSelect }: AlertasUrgentCardsProps) {
  return (
    <section className={`border-b border-[var(--nexo-border)] ${sectionPad} py-9`}>
      <p className={textKicker}>Prioridad operativa</p>
      <h2 className={`mt-2 ${textSectionTitle}`}>Requieren atención inmediata</h2>

      {alerts.length === 0 ? (
        <p className="mt-10 text-[14px] text-[var(--nexo-text-secondary)]">
          No hay incidencias críticas o en seguimiento con los filtros actuales.
        </p>
      ) : (
        <StaggerList className="mt-9 grid gap-4 xl:grid-cols-2">
          {alerts.map((alert) => {
            const meta = STATUS_META[alert.status];
            const active = selectedId === alert.id;
            const impact = formatImpactSummary({
              mediaBefore: alert.mediaBefore,
              mediaAfter: alert.mediaAfter,
            });
            const statusMotionClass =
              alert.status === "critico"
                ? "nexo-alert-critical"
                : alert.status === "seguimiento"
                  ? "nexo-alert-watch"
                  : "";

            return (
              <StaggerItem key={alert.id}>
              <article
                className={`${incidentCard} ${incidentCardHover} border-l-2 ${meta.cardEdge} ${statusMotionClass} ${
                  active ? incidentCardActive : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <RestaurantBrandLine
                    brand={alert.brand}
                    name={alert.restaurant}
                    logoSize="sm"
                    nameClassName="text-[16px] font-semibold tracking-[-0.02em] text-[var(--nexo-text)]"
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    {meta.priority !== "—" && (
                      <span className={`${priorityBadge} ${meta.priorityBadge}`}>{meta.priority}</span>
                    )}
                    <span className={`${metricPill} ${meta.pill}`}>{meta.label}</span>
                  </div>
                </div>

                <div className="mt-7 grid gap-6 border-t border-[var(--nexo-border)] pt-6 sm:grid-cols-2">
                  <div>
                    <p className={textKicker}>Media del local</p>
                    <p className="mt-2 font-mono text-[20px] font-semibold tabular-nums tracking-tight text-[var(--nexo-text)]">
                      {formatImpactRange(alert)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--nexo-text-tertiary)]">
                      Antes y después de esta reseña en el periodo
                    </p>
                  </div>
                  <div>
                    <p className={textKicker}>Variación</p>
                    <p
                      className={`mt-2 font-mono text-[20px] font-semibold tabular-nums tracking-tight ${impactToneClass(impact.tone)}`}
                    >
                      {impact.delta}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--nexo-text-tertiary)]">
                      {impact.subline}
                    </p>
                  </div>
                </div>

                <div className={`${insightBlock} mt-5`}>
                  <p className={textKicker}>Comentario del cliente</p>
                  <CommentExcerpt
                    text={alert.whatHappened}
                    reviewHref={getReviewHrefFromAlertId(alert.id) ?? undefined}
                    maxLength={130}
                    className="mt-2"
                  />
                </div>

                <div className={`${insightBlock} mt-3`}>
                  <p className={textKicker}>Motivo principal</p>
                  <p className="mt-2 text-[14px] text-[var(--nexo-text)]">{alert.mainMotive}</p>
                </div>

                <div className={`${insightBlock} mt-3`}>
                  <p className={textKicker}>Recomendación operativa</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
                    {alert.recommendation}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(alert.id)}
                  className={`${btnPrimary} mt-6 w-full sm:w-auto`}
                >
                  Abrir incidencia
                </button>
              </article>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </section>
  );
}
