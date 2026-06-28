import { summaryCard } from "./nexo-styles";

type SummaryCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  valueClass?: string;
  cardClass?: string;
  loading?: boolean;
};

export function SummaryCard({
  label,
  value,
  hint,
  valueClass = "text-white",
  cardClass = "",
  loading,
}: SummaryCardProps) {
  return (
    <div className={`${summaryCard} ${cardClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-600">{label}</p>
      {loading ? (
        <div className="mt-4 h-9 w-14 animate-pulse rounded bg-white/[0.04]" />
      ) : (
        <p
          className={`mt-4 font-mono text-[28px] font-light tabular-nums leading-none tracking-tight sm:text-[32px] ${valueClass}`}
        >
          {value}
        </p>
      )}
      {hint && !loading && (
        <p className="mt-3 text-[12px] leading-relaxed text-gray-600">{hint}</p>
      )}
    </div>
  );
}
