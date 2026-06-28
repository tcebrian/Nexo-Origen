import { glass as nexoGlass, glassPanel } from "@/app/dashboard/_components/ui/nexo-styles";

export {
  shellPremiumHeader,
  shellWorkspace,
  glass,
  glassPanel,
  ambientLayer,
  sectionPad,
  textKicker,
  textSectionTitle,
  summaryCard,
  insightBlock,
  btnOutline,
  btnPrimary,
  filterToggle,
  filterToggleIdle,
  filterToggleActive,
  linkAccent,
} from "@/app/dashboard/_components/ui/nexo-styles";

export const shell = nexoGlass;
export const shellPremium = nexoGlass;
export const inboxShell = glassPanel;
export const inboxGrid = "min-h-[calc(100svh-20rem)]";

export const textTitle = "text-[28px] font-semibold tracking-tight text-[var(--nexo-text)]";
export const textSubtitle = "text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]";

export const inputField =
  "w-full rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] py-2.5 pl-10 pr-4 text-[14px] text-[var(--nexo-text)] outline-none transition placeholder:text-[var(--nexo-text-tertiary)] focus:border-[var(--nexo-accent-border)] focus:ring-2 focus:ring-[var(--nexo-accent-muted)]";

export const inboxCard = `group relative overflow-hidden rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-5 py-5 transition duration-200`;

export const inboxCardHover =
  "hover:border-[var(--nexo-border-strong)] hover:shadow-[var(--nexo-shadow-md)]";

export const inboxCardActive =
  "border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] ring-1 ring-inset ring-[var(--nexo-accent-border)]";

export const surfaceDetail = "bg-[var(--nexo-card)]";

export const panelChrome = "border-b border-[var(--nexo-border)] bg-[var(--nexo-inset)]";

export const btnEnter =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-1.5 text-[11px] font-medium text-[var(--nexo-text-secondary)] opacity-0 transition group-hover:opacity-100 hover:border-[var(--nexo-accent-border)] hover:bg-[var(--nexo-accent-muted)] hover:text-[var(--nexo-accent)]";

export const btnEnterVisible =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] px-3 py-1.5 text-[11px] font-medium text-[var(--nexo-accent)] transition hover:bg-[var(--nexo-accent-muted)]";
