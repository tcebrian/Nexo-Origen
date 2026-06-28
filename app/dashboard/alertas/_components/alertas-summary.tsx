import type { AlertKpis } from "@/lib/alerts/types";
import { STATUS_META } from "@/lib/alerts/status";
import { summaryCard } from "./ui/alertas-styles";

type AlertasSummaryProps = {
  kpis: AlertKpis;
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

export function AlertasSummary({ kpis, loading }: AlertasSummaryProps) {
  return (
    <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SummaryCard
        label="Críticas"
        value={kpis.critical}
        hint="Requieren atención inmediata"
        valueClass={STATUS_META.critico.summaryValue}
        cardClass={STATUS_META.critico.summaryCard}
        loading={loading}
      />
      <SummaryCard
        label="En seguimiento"
        value={kpis.followUp}
        hint="Monitorización activa"
        valueClass={STATUS_META.seguimiento.summaryValue}
        cardClass={STATUS_META.seguimiento.summaryCard}
        loading={loading}
      />
      <SummaryCard
        label="Resueltas esta semana"
        value={kpis.resolvedThisWeek}
        hint="Incidencias cerradas"
        valueClass={STATUS_META.resuelto.summaryValue}
        cardClass={STATUS_META.resuelto.summaryCard}
        loading={loading}
      />
    </section>
  );
}
