"use client";

import { STATUS_META } from "@/lib/alerts/status";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import type { RestaurantAlert } from "@/lib/alerts/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import {
  metricPill,
  radarRow,
  radarRowActive,
  radarRowHover,
  sectionPad,
  textKicker,
  textSectionTitle,
} from "./ui/alertas-styles";

type AlertasRiskRadarProps = {
  alerts: RestaurantAlert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function AlertasRiskRadar({ alerts, selectedId, onSelect }: AlertasRiskRadarProps) {
  return (
    <section className={`${sectionPad} py-9`}>
      <p className={textKicker}>Vista de red</p>
      <h2 className={`mt-2 ${textSectionTitle}`}>Radar de riesgo</h2>
      <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">Ordenado por prioridad operativa.</p>

      <div className="mt-7 divide-y divide-[var(--nexo-border)] rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]">
        {alerts.length === 0 ? (
          <p className="px-4 py-12 text-center text-[14px] text-[var(--nexo-text-secondary)]">
            Sin locales en el radar con los filtros actuales.
          </p>
        ) : (
          alerts.map((alert) => {
            const meta = STATUS_META[alert.status];
            const active = selectedId === alert.id;
            const impact = formatImpactSummary({
              mediaBefore: alert.mediaBefore,
              mediaAfter: alert.mediaAfter,
            });

            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => onSelect(alert.id)}
                className={`${radarRow} w-full border-l-2 ${meta.cardEdge} ${
                  active ? radarRowActive : radarRowHover
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <RestaurantBrandLine
                    brand={alert.brand}
                    name={alert.restaurant}
                    logoSize="sm"
                    nameClassName="truncate text-[14px] font-medium tracking-[-0.01em] text-[var(--nexo-text)]"
                  />
                </div>

                <div className="flex shrink-0 items-center gap-5">
                  <span className={`hidden sm:inline ${metricPill} ${meta.pill}`}>
                    {meta.radarLabel}
                  </span>
                  <span
                    className={`min-w-[5.5rem] text-right font-mono text-[13px] font-medium tabular-nums ${impactToneClass(impact.tone)}`}
                    title={impact.subline}
                  >
                    {impact.delta}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
