import { glass as nexoGlass } from "@/app/dashboard/_components/ui/nexo-styles";

export {
  glass,
  textKicker,
  textSectionTitle,
  metricPill,
  linkAccent,
  insightBlock,
} from "@/app/dashboard/_components/ui/nexo-styles";

export const shell = nexoGlass;

export const card = `rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]`;

export const cardInteractive = `${card} transition-all duration-200 hover:border-[var(--nexo-border-strong)] hover:shadow-[var(--nexo-shadow-md)]`;

export const sectionPad = "px-5 py-5 lg:px-6";

export const textTitle = "text-lg font-semibold tracking-tight text-[var(--nexo-text)]";
export const textSubtitle = "text-[15px] leading-relaxed text-[var(--nexo-text-secondary)]";

export const segmentedControl =
  "inline-flex rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] p-1";

export const segmentedItem = "rounded-lg px-3 py-2 text-sm font-medium transition";

export const segmentedItemActive =
  "bg-[var(--nexo-card)] text-[var(--nexo-accent)] shadow-[var(--nexo-shadow-sm)]";

export const segmentedItemIdle =
  "text-[var(--nexo-text-secondary)] hover:text-[var(--nexo-text)]";
