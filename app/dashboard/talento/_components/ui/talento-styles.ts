export {
  shellPremiumHeader,
  shellWorkspace,
  ambientLayer,
  sectionPad,
  textBody,
  metricPill,
  btnOutline,
  btnPrimary,
  filterToggle,
  filterToggleIdle,
  skeletonBlock,
} from "@/app/dashboard/_components/ui/nexo-styles";

/** Panel principal con profundidad y borde interior sutil */
export const talentoPanel =
  "relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#06050B] shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]";

export const talentoPanelInner =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.08),transparent)]";

export const talentoPanelPad = "relative p-6 sm:p-7";

export const talentoKpiCard =
  "group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 transition duration-300 hover:border-white/[0.1] hover:bg-white/[0.03] sm:px-6 sm:py-6";

export const talentoKpiAccent =
  "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent opacity-0 transition group-hover:opacity-100";

export const textKicker =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/55";

export const textSectionTitle =
  "text-[17px] font-medium tracking-[-0.02em] text-white sm:text-[18px]";

export const textSectionDesc =
  "mt-1.5 text-[12px] leading-relaxed text-gray-500";

export const employeeFeaturedCard =
  "group relative flex flex-col items-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center transition duration-300 hover:border-white/[0.12] hover:bg-white/[0.035]";

export const employeeFeaturedCardTop =
  "border-violet-400/20 bg-gradient-to-b from-violet-500/[0.08] to-white/[0.02] shadow-[0_0_40px_rgba(124,58,237,0.08)]";

export const mentionPill =
  "inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200";

export const negativePill =
  "inline-flex items-center rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-red-300";

export const trendUp = "text-emerald-400";
export const trendDown = "text-red-400";

export const rankBadgeBase =
  "absolute -left-0.5 -top-0.5 flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-[11px] font-bold shadow-lg";

export const rankBadgeGold =
  `${rankBadgeBase} border-amber-400/30 bg-gradient-to-br from-amber-400/25 to-amber-600/10 text-amber-200`;

export const rankBadgeSilver =
  `${rankBadgeBase} border-gray-400/25 bg-gradient-to-br from-gray-300/20 to-gray-500/10 text-gray-200`;

export const rankBadgeBronze =
  `${rankBadgeBase} border-orange-400/25 bg-gradient-to-br from-orange-400/20 to-orange-600/10 text-orange-200`;

export const listRowCard =
  "flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-3.5 transition hover:border-white/[0.09] hover:bg-white/[0.025]";

export const quoteBlock =
  "relative mt-4 w-full rounded-lg border border-white/[0.05] bg-black/25 px-3.5 py-3 text-left before:absolute before:left-0 before:top-3 before:h-[calc(100%-24px)] before:w-0.5 before:rounded-full before:bg-violet-400/35";

export const tableHeadCell =
  "pb-3.5 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600";

export const tableRow =
  "border-b border-white/[0.04] transition hover:bg-white/[0.02] last:border-0";
