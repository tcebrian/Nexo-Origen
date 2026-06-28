"use client";

import { formatRelativeDetected, getAlertRecommendation, STATUS_META } from "@/lib/alerts/status";
import { getAlertMotiveLabel } from "@/lib/alerts/filters";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import type { RestaurantAlert } from "@/lib/alerts/types";
import { StaggerItem, StaggerList } from "../../_components/motion/stagger";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { metricPill, radarRow, radarRowActive, radarRowHover, sectionPad, textKicker, textSectionTitle } from "./ui/alertas-styles";

type AlertasInboxProps = {
  alerts: RestaurantAlert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function AlertasInbox({ alerts, selectedId, onSelect }: AlertasInboxProps) {
  return (
    <section className={`${sectionPad} py-6`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={textKicker}>Todas las alertas</p>
          <h2 className={`mt-1 ${textSectionTitle}`}>Lista priorizada</h2>
        </div>
        <span className="text-[12px] tabular-nums text-[var(--nexo-text-tertiary)]">{alerts.length} incidencias</span>
      </div>

      <div className="mt-5 divide-y divide-[var(--nexo-border)] rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]">
        {alerts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[15px] font-medium text-[var(--nexo-text)]">Todo bajo control</p>
            <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">
              No hay alertas con los filtros actuales. Prueba ampliar el periodo o quitar filtros.
            </p>
          </div>
        ) : (
          <StaggerList className="divide-y divide-[var(--nexo-border)]">
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
                  <button
                    type="button"
                    onClick={() => onSelect(alert.id)}
                    className={`${radarRow} w-full border-l-2 ${meta.cardEdge} ${statusMotionClass} ${
                      active ? radarRowActive : radarRowHover
                    }`}
                  >
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <RestaurantBrandLine
                      brand={alert.brand}
                      name={alert.restaurant}
                      logoSize="sm"
                      nameClassName="truncate text-[14px] font-medium text-[var(--nexo-text)]"
                    />
                    <span className={`${metricPill} ${meta.pill}`}>{meta.radarLabel}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[12px] text-[var(--nexo-text-secondary)]">
                    {getAlertMotiveLabel(alert)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--nexo-text-tertiary)]">
                    {formatRelativeDetected(alert.detectedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`font-mono text-[13px] font-medium tabular-nums ${impactToneClass(impact.tone)}`}
                    title={impact.subline}
                  >
                    {impact.delta}
                  </span>
                  <span className="text-[10px] text-[var(--nexo-text-tertiary)]">impacto media</span>
                </div>
                  </button>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </div>
    </section>
  );
}
