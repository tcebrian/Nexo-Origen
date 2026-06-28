const card =
  "rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]";

export const shell = `${card} shadow-[var(--nexo-shadow-md)]`;

export const panelInset = "rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]";

export const sectionPad = "px-6 py-6 lg:px-7 lg:py-7";
export const sectionPadCompact = "px-5 py-5 lg:px-6 lg:py-6";

export const controlHeight = "h-10";

export const inputField =
  "h-10 w-full rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3.5 text-[13px] text-[var(--nexo-text)] outline-none transition placeholder:text-[var(--nexo-text-tertiary)] focus:border-[var(--nexo-accent-border)] focus:ring-2 focus:ring-[var(--nexo-accent-muted)]";

export const selectField =
  "h-10 w-full appearance-none rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3.5 pr-9 text-[13px] text-[var(--nexo-text)] outline-none transition focus:border-[var(--nexo-accent-border)] focus:ring-2 focus:ring-[var(--nexo-accent-muted)]";

export const filterLabel =
  "mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]";

export const cardBase = `flex h-full flex-col ${card} transition duration-200 hover:shadow-[var(--nexo-shadow-md)]`;

export const cardNeutral = "border-[var(--nexo-border)]";
export const cardWatch =
  "border-[var(--nexo-watch-border)] bg-gradient-to-b from-[var(--nexo-watch-muted)] to-[var(--nexo-card)]";
export const cardCritical =
  "border-[var(--nexo-critical-border)] bg-gradient-to-b from-[var(--nexo-critical-muted)] to-[var(--nexo-card)]";

export const metricCell =
  "rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3.5 py-3";

export const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-4 text-[12px] font-medium text-[var(--nexo-text)] transition hover:border-[var(--nexo-border-strong)] hover:bg-[var(--nexo-inset)]";

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--nexo-accent)] bg-[var(--nexo-accent)] px-4 text-[12px] font-medium text-[#FDFCFA] transition hover:border-[var(--nexo-accent-hover)] hover:bg-[var(--nexo-accent-hover)]";

export const textKicker =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]";
export const textTitle = "text-[28px] font-semibold tracking-tight text-[var(--nexo-text)]";
export const textSectionTitle = "text-[15px] font-medium tracking-tight text-[var(--nexo-text)]";
export const textSubtitle = "mt-2 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]";

export const statusPill = {
  on_target:
    "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]",
  watch: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]",
  critical:
    "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
} as const;

export const statusDot = {
  on_target: "bg-[var(--nexo-success)]",
  watch: "bg-[var(--nexo-watch)]",
  critical: "bg-[var(--nexo-critical)]",
} as const;

export const protectionSegment = {
  on_target: "bg-[var(--nexo-success)]",
  watch: "bg-[var(--nexo-watch)]",
  critical: "bg-[var(--nexo-critical)]",
} as const;

export const protectionSegmentEmpty = "bg-[var(--nexo-border)]";

export const summaryAccent = {
  neutral: "from-transparent via-[var(--nexo-border)] to-transparent",
  emerald: "from-transparent via-[var(--nexo-success-border)] to-transparent",
  amber: "from-transparent via-[var(--nexo-watch-border)] to-transparent",
  red: "from-transparent via-[var(--nexo-critical-border)] to-transparent",
} as const;
