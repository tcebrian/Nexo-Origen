import type { HealthStatus } from "@/lib/restaurants/types";

export const healthStyles: Record<
  HealthStatus,
  {
    text: string;
    bg: string;
    border: string;
    dot: string;
    bar: string;
    glow: string;
  }
> = {
  protected: {
    text: "text-[var(--nexo-success)]",
    bg: "bg-[var(--nexo-success-muted)]",
    border: "border-[var(--nexo-success-border)]",
    dot: "bg-[var(--nexo-success)]",
    bar: "bg-[var(--nexo-success)]",
    glow: "from-emerald-500/8 via-transparent to-transparent",
  },
  watch: {
    text: "text-[var(--nexo-watch)]",
    bg: "bg-[var(--nexo-watch-muted)]",
    border: "border-[var(--nexo-watch-border)]",
    dot: "bg-[var(--nexo-watch)]",
    bar: "bg-[var(--nexo-watch)]",
    glow: "from-amber-500/8 via-transparent to-transparent",
  },
  risk: {
    text: "text-[var(--nexo-critical)]",
    bg: "bg-[var(--nexo-critical-muted)]",
    border: "border-[var(--nexo-critical-border)]",
    dot: "bg-[var(--nexo-critical)]",
    bar: "bg-[var(--nexo-critical)]",
    glow: "from-red-500/8 via-transparent to-transparent",
  },
};

export const detailShell =
  "relative overflow-hidden rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]";

export const detailSection = "px-7 py-8 lg:px-9 lg:py-9";

export const detailKicker =
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-tertiary)]";

export const detailMetricLabel =
  "text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]";

export const detailMetricValue =
  "mt-2 text-[28px] font-semibold tabular-nums tracking-tight text-[var(--nexo-text)]";

export const detailMetricCard =
  "rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-4";

export const detailDivider = "border-t border-[var(--nexo-border)]";

export const detailExecutiveCard = `${detailShell} overflow-hidden shadow-[var(--nexo-shadow-md)]`;

export const detailExecutiveMetric =
  "rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3.5 py-4 shadow-[var(--nexo-shadow-sm)]";

export const detailChartCard = `${detailShell} flex min-h-[520px] flex-col shadow-[var(--nexo-shadow-sm)]`;

export const detailChartFrame =
  "relative h-[320px] w-full shrink-0 overflow-hidden rounded-2xl border border-[var(--nexo-border)] bg-gradient-to-b from-[var(--nexo-inset)] to-[var(--nexo-card)] p-1";

export const detailChartFrameInner = "h-full w-full overflow-hidden rounded-[14px] bg-[var(--nexo-card)]/80";

export const detailStatTile =
  "rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-4 py-3.5 text-center shadow-[var(--nexo-shadow-sm)]";

export const detailSectionTitle =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-tertiary)]";
