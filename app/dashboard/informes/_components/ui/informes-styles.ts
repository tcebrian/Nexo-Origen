import { glass as nexoGlass } from "@/app/dashboard/_components/ui/nexo-styles";

export {
  shellPremiumHeader,
  glass,
  sectionPad,
  textKicker,
  textSectionTitle,
  metricPill,
  btnOutline,
  btnPrimary,
  btnGhost,
  linkAccent,
} from "@/app/dashboard/_components/ui/nexo-styles";

export const shell = nexoGlass;

export const card = `rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]`;

export const cardInteractive = `${card} transition-all duration-200 hover:border-[var(--nexo-border-strong)] hover:shadow-[var(--nexo-shadow-md)]`;

export const textTitle = "text-lg font-semibold tracking-tight text-[var(--nexo-text)]";

export const inputField =
  "w-full rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3.5 py-2.5 text-sm text-[var(--nexo-text)] outline-none transition focus:border-[var(--nexo-accent-border)] focus:ring-2 focus:ring-[var(--nexo-accent-muted)]";

export const segmentedControl =
  "inline-flex flex-wrap rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] p-1";

export const segmentedItem = "rounded-lg px-3 py-2 text-sm font-medium transition";

export const segmentedItemActive =
  "bg-[var(--nexo-card)] text-[var(--nexo-accent)] shadow-[var(--nexo-shadow-sm)]";

export const segmentedItemIdle =
  "text-[var(--nexo-text-secondary)] hover:text-[var(--nexo-text)]";
