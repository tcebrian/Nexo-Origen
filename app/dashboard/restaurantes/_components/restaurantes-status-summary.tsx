import { MiniSparkline } from "../../_components/charts";
import type { NetworkStatusSummary } from "@/lib/restaurants/types";
import { summaryAccent } from "./ui/restaurantes-styles";

type RestaurantesStatusSummaryProps = {
  summary: NetworkStatusSummary;
};

function SummaryCard({
  label,
  value,
  hint,
  tone,
  sparkColor,
  sparkValues,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone: keyof typeof summaryAccent;
  sparkColor: string;
  sparkValues: number[];
}) {
  const toneStyles = {
    neutral: "text-[var(--nexo-text)]",
    emerald: "text-[var(--nexo-success)]",
    amber: "text-[var(--nexo-watch)]",
    red: "text-[var(--nexo-critical)]",
  } as const;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-6 py-5 shadow-[var(--nexo-shadow-sm)]">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${summaryAccent[tone]}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
            {label}
          </p>
          <p
            className={`mt-3 font-mono text-[36px] font-light leading-none tabular-nums tracking-tight ${toneStyles[tone]}`}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-2 text-[12px] text-[var(--nexo-text-secondary)]">{hint}</p>
          ) : null}
        </div>
        <MiniSparkline values={sparkValues} color={sparkColor} width={72} height={32} filled={false} />
      </div>
    </div>
  );
}

export function RestaurantesStatusSummary({ summary }: RestaurantesStatusSummaryProps) {
  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Locales en objetivo"
        value={summary.onTarget}
        hint={`${summary.onTargetPct}% del total`}
        tone="emerald"
        sparkColor="var(--nexo-success)"
        sparkValues={[summary.onTargetPct * 0.7, summary.onTargetPct * 0.85, summary.onTargetPct]}
      />
      <SummaryCard
        label="En vigilancia"
        value={summary.onWatch}
        hint={`${summary.onWatchPct}% del total`}
        tone="amber"
        sparkColor="var(--nexo-watch)"
        sparkValues={[summary.onWatchPct * 1.2, summary.onWatchPct, summary.onWatchPct * 0.9]}
      />
      <SummaryCard
        label="En riesgo"
        value={summary.critical}
        hint={`${summary.criticalPct}% del total`}
        tone="red"
        sparkColor="var(--nexo-critical)"
        sparkValues={[summary.criticalPct * 1.3, summary.criticalPct, summary.criticalPct * 0.8]}
      />
      <SummaryCard
        label="Media de la red"
        value={summary.networkAverage.toFixed(2)}
        hint={`Objetivo ${summary.targetMedia.toFixed(2)}`}
        tone="neutral"
        sparkColor="var(--nexo-accent)"
        sparkValues={[
          summary.networkAverage - 0.08,
          summary.networkAverage - 0.04,
          summary.networkAverage,
        ]}
      />
    </section>
  );
}
