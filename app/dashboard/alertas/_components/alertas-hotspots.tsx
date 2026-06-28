"use client";

import type { RestaurantHotspot } from "@/lib/alerts/filters";
import { BrandMark } from "../../_components/brand-mark";
import { metricPill, textKicker } from "./ui/alertas-styles";

type AlertasHotspotsProps = {
  hotspots: RestaurantHotspot[];
  activeRestaurant?: string;
  onSelectRestaurant: (slug: string) => void;
};

export function AlertasHotspots({ hotspots, activeRestaurant, onSelectRestaurant }: AlertasHotspotsProps) {
  if (hotspots.length === 0) return null;

  return (
    <section className="mb-8">
      <p className={textKicker}>Dónde mirar primero</p>
      <p className="mt-1 text-[13px] text-[var(--nexo-text-secondary)]">
        Locales con más incidencias abiertas en el periodo.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {hotspots.map((spot) => {
          const active = activeRestaurant === spot.slug;
          return (
            <button
              key={spot.slug}
              type="button"
              onClick={() => onSelectRestaurant(spot.slug)}
              className={`inline-flex min-w-[200px] shrink-0 flex-col rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-violet-400/30 bg-violet-500/10 ring-1 ring-inset ring-violet-400/20"
                  : "border-[var(--nexo-border)] bg-[var(--nexo-card)] hover:border-[var(--nexo-border-strong)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <BrandMark brand={spot.brand} size="xs" />
                <span className="truncate text-[13px] font-medium text-[var(--nexo-text)]">{spot.name}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`${metricPill} border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]`}>
                  {spot.critical} crítica{spot.critical === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] text-[var(--nexo-text-tertiary)]">{spot.total} en total</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
