"use client";

import type { PreventWeeklySummary } from "@/lib/prevent/types";
import { summaryCard } from "./ui/prevent-styles";

type PreventWeeklySummaryProps = {
  weekly: PreventWeeklySummary;
  loading?: boolean;
};

const items = [
  {
    key: "positives",
    label: "Positivas necesarias",
    hint: "Para alcanzar el objetivo global",
    getValue: (w: PreventWeeklySummary) => `+${w.positivesNeededNetwork}`,
    valueClass: "text-[var(--nexo-accent)]",
    cardClass: "border-violet-400/15 bg-violet-500/8",
  },
  {
    key: "negatives",
    label: "Negativas absorbibles",
    hint: "Margen de la red en el periodo",
    getValue: (w: PreventWeeklySummary) => `-${w.negativesBufferNetwork}`,
    valueClass: "text-[var(--nexo-success)]",
    cardClass: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)]",
  },
  {
    key: "protected",
    label: "Locales protegidos",
    hint: "Con margen amplio",
    getValue: (w: PreventWeeklySummary) => String(w.protectedCount),
    valueClass: "text-[var(--nexo-text)]",
    cardClass: "border-[var(--nexo-border)] bg-[var(--nexo-inset)]",
  },
  {
    key: "risk",
    label: "En riesgo o vigilancia",
    hint: "Requieren seguimiento",
    getValue: (w: PreventWeeklySummary) => String(w.atRiskCount),
    valueClass: "text-[var(--nexo-watch)]",
    cardClass: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)]",
  },
] as const;

export function PreventWeeklySummary({ weekly, loading }: PreventWeeklySummaryProps) {
  return (
    <section className="mt-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
        Resumen del periodo
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.key} className={`${summaryCard} ${item.cardClass}`}>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-600">{item.label}</p>
            {loading ? (
              <div className="mt-3 h-8 w-14 animate-pulse rounded bg-white/[0.04]" />
            ) : (
              <p className={`mt-3 font-mono text-[28px] font-light tabular-nums leading-none ${item.valueClass}`}>
                {item.getValue(weekly)}
              </p>
            )}
            <p className="mt-2 text-[11px] text-gray-600">{item.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-[var(--nexo-text-tertiary)]">
        Nexo Prevent calcula el impacto de cada reseña sobre la media y anticipa cuántas positivas hacen falta o
        cuántas negativas puede absorber cada local antes de caer del objetivo.
      </p>
    </section>
  );
}
