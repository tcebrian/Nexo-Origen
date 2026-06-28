"use client";

import type { AlertKpis } from "@/lib/alerts/types";
import { STATUS_META } from "@/lib/alerts/status";
import { summaryCard } from "./ui/alertas-styles";

export type AlertSummaryFilter = "all" | "open" | "critico" | "seguimiento" | "restaurants";

type AlertasExecutiveSnapshotProps = {
  kpis: AlertKpis;
  periodLabel: string;
  brandLabel?: string | null;
  restaurantLabel?: string | null;
  loading?: boolean;
  activeFilter?: AlertSummaryFilter;
  onFilter?: (filter: AlertSummaryFilter) => void;
};

const cards: {
  key: AlertSummaryFilter;
  label: string;
  getValue: (kpis: AlertKpis) => number;
  valueClass: string;
  accentClass: string;
}[] = [
  {
    key: "open",
    label: "Abiertas",
    getValue: (kpis) => kpis.open,
    valueClass: "text-white",
    accentClass: "from-violet-500/20 via-violet-500/5 to-transparent border-violet-400/20",
  },
  {
    key: "critico",
    label: "Críticas",
    getValue: (kpis) => kpis.critical,
    valueClass: STATUS_META.critico.summaryValue,
    accentClass: "from-red-500/10 to-transparent border-[var(--nexo-critical-border)]",
  },
  {
    key: "seguimiento",
    label: "Seguimiento",
    getValue: (kpis) => kpis.followUp,
    valueClass: STATUS_META.seguimiento.summaryValue,
    accentClass: "from-amber-500/10 to-transparent border-[var(--nexo-watch-border)]",
  },
  {
    key: "restaurants",
    label: "Locales",
    getValue: (kpis) => kpis.restaurantsAffected,
    valueClass: "text-[var(--nexo-text)]",
    accentClass: "from-white/[0.03] to-transparent border-[var(--nexo-border)]",
  },
];

function buildBriefing(
  kpis: AlertKpis,
  periodLabel: string,
  brandLabel?: string | null,
  restaurantLabel?: string | null
) {
  const scope = restaurantLabel ?? brandLabel;

  if (kpis.open === 0) {
    if (restaurantLabel) {
      return `${restaurantLabel} no tiene alertas abiertas en ${periodLabel}.`;
    }
    if (brandLabel) {
      return `${brandLabel} está estable en ${periodLabel}: sin incidencias abiertas.`;
    }
    return `La red está estable en ${periodLabel}. No hay alertas que requieran acción.`;
  }

  if (kpis.critical > 0) {
    const lead = scope
      ? `En ${scope}, tienes ${kpis.critical} crítica${kpis.critical === 1 ? "" : "s"}`
      : `Tienes ${kpis.critical} alerta${kpis.critical === 1 ? "" : "s"} crítica${kpis.critical === 1 ? "" : "s"}`;
    return `${lead} en ${kpis.restaurantsAffected} local${kpis.restaurantsAffected === 1 ? "" : "es"} (${periodLabel}). Revisa la prioridad #1.`;
  }

  const lead = scope
    ? `En ${scope}, hay ${kpis.open} alerta${kpis.open === 1 ? "" : "s"} en seguimiento`
    : `Hay ${kpis.open} alerta${kpis.open === 1 ? "" : "s"} abiertas`;
  return `${lead} en ${kpis.restaurantsAffected} local${kpis.restaurantsAffected === 1 ? "" : "es"} (${periodLabel}).`;
}

export function AlertasExecutiveSnapshot({
  kpis,
  periodLabel,
  brandLabel,
  restaurantLabel,
  loading,
  activeFilter = "all",
  onFilter,
}: AlertasExecutiveSnapshotProps) {
  const briefing = buildBriefing(kpis, periodLabel, brandLabel, restaurantLabel);
  const isStable = !loading && kpis.open === 0;

  return (
    <section className="mb-8">
      <div
        className={`relative overflow-hidden rounded-[24px] border px-5 py-5 shadow-[var(--nexo-shadow-sm)] lg:px-7 lg:py-6 ${
          isStable
            ? "border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 via-[var(--nexo-card)] to-[var(--nexo-card)]"
            : "border-[var(--nexo-border)] bg-gradient-to-br from-violet-500/10 via-[var(--nexo-card)] to-[var(--nexo-card)]"
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
                Resumen ejecutivo
              </p>
              <span className="rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-2.5 py-0.5 text-[10px] text-[var(--nexo-text-secondary)]">
                {periodLabel}
              </span>
            </div>

            {loading ? (
              <div className="mt-4 space-y-2">
                <div className="h-10 w-24 animate-pulse rounded-lg bg-white/[0.04]" />
                <div className="h-5 w-full max-w-xl animate-pulse rounded bg-white/[0.04]" />
              </div>
            ) : (
              <>
                <p
                  className={`mt-4 font-mono text-[48px] font-light leading-none tabular-nums tracking-tight ${
                    isStable ? "text-emerald-300" : "text-white"
                  }`}
                >
                  {kpis.open}
                </p>
                <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
                  alertas abiertas
                </p>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--nexo-text)]">{briefing}</p>
                {!isStable && kpis.resolvedThisWeek > 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--nexo-text-tertiary)]">
                    {kpis.resolvedThisWeek} local{kpis.resolvedThisWeek === 1 ? "" : "es"} mejoraron su media esta semana.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:min-w-[420px]">
            {cards.map((card) => {
              const isActive = activeFilter === card.key;
              const Wrapper = onFilter ? "button" : "div";

              return (
                <Wrapper
                  key={card.key}
                  type={onFilter ? "button" : undefined}
                  onClick={onFilter ? () => onFilter(card.key) : undefined}
                  className={`${summaryCard} bg-gradient-to-br ${card.accentClass} px-4 py-3.5 text-left transition ${
                    isActive ? "ring-1 ring-inset ring-violet-400/30" : "hover:border-[var(--nexo-border-strong)]"
                  }`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-600">{card.label}</p>
                  {loading ? (
                    <div className="mt-3 h-8 w-10 animate-pulse rounded bg-white/[0.04]" />
                  ) : (
                    <p className={`mt-3 font-mono text-[28px] font-light tabular-nums leading-none ${card.valueClass}`}>
                      {card.getValue(kpis)}
                    </p>
                  )}
                </Wrapper>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
