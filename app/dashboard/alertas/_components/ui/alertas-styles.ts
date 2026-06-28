export {
  shellPremiumHeader,
  shellWorkspace,
  ambientLayer,
  sectionPad,
  textKicker,
  textSectionTitle,
  textBody,
  summaryCard,
  insightBlock,
  metricPill,
  btnOutline,
  btnPrimary,
  filterToggle,
  filterToggleIdle,
  filterToggleActive,
  linkAccent,
} from "@/app/dashboard/_components/ui/nexo-styles";

export const workspaceGrid =
  "grid min-h-[calc(100svh-22rem)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(400px,440px)]";

export const incidentCard = `nexo-card-surface relative overflow-hidden rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-6 py-6 transition duration-200 shadow-[var(--nexo-shadow-sm)]`;

export const incidentCardHover =
  "hover:border-[var(--nexo-border-strong)] hover:shadow-[var(--nexo-shadow-md)]";

export const incidentCardActive =
  "border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] ring-1 ring-inset ring-[var(--nexo-accent-border)]";

export const radarRow =
  "flex w-full items-center justify-between gap-4 rounded-lg border border-transparent px-4 py-3.5 text-left transition";

export const radarRowActive = "border-[var(--nexo-border)] bg-[var(--nexo-inset)]";

export const radarRowHover = "hover:border-[var(--nexo-border)] hover:bg-[var(--nexo-inset)]";

export const surfaceDetail = "bg-[var(--nexo-card)]";

export const panelChrome = "border-b border-[var(--nexo-border)] bg-[var(--nexo-inset)]";

export const priorityBadge =
  "inline-flex items-center rounded-md border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-[var(--nexo-text-secondary)]";
