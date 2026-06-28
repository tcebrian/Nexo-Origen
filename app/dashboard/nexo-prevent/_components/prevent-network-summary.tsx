import type { PreventNetworkSummary } from "@/lib/prevent/types";
import { PREVENT_STATUS_META } from "@/lib/prevent/status";
import { summaryCard } from "./ui/prevent-styles";

type PreventNetworkSummaryProps = {
  summary: PreventNetworkSummary;
  loading?: boolean;
};

function SummaryCard({
  label,
  value,
  hint,
  valueClass,
  cardClass,
  loading,
}: {
  label: string;
  value: number;
  hint: string;
  valueClass: string;
  cardClass: string;
  loading?: boolean;
}) {
  return (
    <div className={`${summaryCard} ${cardClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-600">{label}</p>
      {loading ? (
        <div className="mt-4 h-9 w-14 animate-pulse rounded bg-white/[0.04]" />
      ) : (
        <p
          className={`mt-4 font-mono text-[32px] font-light tabular-nums leading-none tracking-tight ${valueClass}`}
        >
          {value}
        </p>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-gray-600">{hint}</p>
    </div>
  );
}

export function PreventNetworkSummary({ summary, loading }: PreventNetworkSummaryProps) {
  return (
    <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SummaryCard
        label="Restaurantes protegidos"
        value={summary.protectedCount}
        hint="Margen amplio sobre el objetivo 4.4"
        valueClass={PREVENT_STATUS_META.protegido.summaryValue}
        cardClass={PREVENT_STATUS_META.protegido.summaryCard}
        loading={loading}
      />
      <SummaryCard
        label="Restaurantes en vigilancia"
        value={summary.watchCount}
        hint="En objetivo con poco margen de seguridad"
        valueClass={PREVENT_STATUS_META.vigilancia.summaryValue}
        cardClass={PREVENT_STATUS_META.vigilancia.summaryCard}
        loading={loading}
      />
      <SummaryCard
        label="Restaurantes fuera de objetivo"
        value={summary.outsideGoalCount}
        hint="Requieren reseñas positivas para recuperar 4.4"
        valueClass={PREVENT_STATUS_META.fuera_objetivo.summaryValue}
        cardClass={PREVENT_STATUS_META.fuera_objetivo.summaryCard}
        loading={loading}
      />
    </section>
  );
}
