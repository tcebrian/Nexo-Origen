import { COPY } from "@/lib/platform/copy";
import { REPUTATION_TARGET } from "@/lib/status/unified";
import { glass, textKicker } from "./ui/nexo-styles";

type ExecutiveSummaryProps = {
  networkMedia: number;
  onTarget: number;
  onWatch: number;
  critical: number;
  lastUpdated: string | null;
  periodLabel: string;
};

function MetricCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "watch" | "critical" | "accent";
}) {
  const toneClass = {
    default: "text-[var(--nexo-text)]",
    success: "text-[var(--nexo-success)]",
    watch: "text-[var(--nexo-watch)]",
    critical: "text-[var(--nexo-critical)]",
    accent: "text-[var(--nexo-accent)]",
  }[tone];

  return (
    <div className="min-w-0 flex-1 border-l border-[var(--nexo-border)] pl-6 first:border-l-0 first:pl-0">
      <p className={textKicker}>{label}</p>
      <p className={`mt-2 font-mono text-[28px] font-semibold tabular-nums tracking-tight ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

export function ExecutiveSummary({
  networkMedia,
  onTarget,
  onWatch,
  critical,
  lastUpdated,
  periodLabel,
}: ExecutiveSummaryProps) {
  const mediaTone =
    networkMedia >= REPUTATION_TARGET
      ? "success"
      : networkMedia >= REPUTATION_TARGET - 0.15
        ? "watch"
        : networkMedia > 0
          ? "critical"
          : "default";

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <section className={`${glass} px-6 py-6 lg:px-8 lg:py-7`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={textKicker}>{COPY.executiveSummary}</p>
          <p className="mt-1 text-[13px] text-[var(--nexo-text-secondary)]">{periodLabel}</p>
        </div>
        <p className="text-[12px] text-[var(--nexo-text-tertiary)]">
          {COPY.lastUpdated}: {updatedLabel}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:gap-0">
        <MetricCell
          label={COPY.networkMedia}
          value={networkMedia > 0 ? networkMedia.toFixed(2) : "—"}
          tone={mediaTone}
        />
        <MetricCell label={COPY.onTarget} value={onTarget} tone="success" />
        <MetricCell label={COPY.onWatch} value={onWatch} tone="watch" />
        <MetricCell label={COPY.critical} value={critical} tone="critical" />
      </div>
    </section>
  );
}
