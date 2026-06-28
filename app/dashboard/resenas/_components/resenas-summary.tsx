"use client";

import type { ReviewStats } from "@/lib/reviews/types";
import { AnimatedNumber } from "@/app/dashboard/_components/motion/animated-number";
import { summaryCard } from "./ui/resenas-styles";
type ResenasSummaryProps = {
  stats: ReviewStats;
  loading?: boolean;
  onFilter?: (filter: "all" | "positives" | "negatives" | "unreviewed") => void;
  activeFilter?: "all" | "positives" | "negatives" | "unreviewed";
};

const cards = [
  {
    key: "all" as const,
    label: "Reseñas recibidas",
    accent: "text-white",
    glow: "from-violet-500/10",
    icon: (
      <svg className="h-4 w-4 text-violet-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "positives" as const,
    label: "Positivas",
    accent: "text-emerald-300",
    glow: "from-emerald-500/12",
    icon: (
      <svg className="h-4 w-4 text-emerald-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M14 9V5a3 3 0 00-6 0v4M7 9h10l1 12H6L7 9z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "negatives" as const,
    label: "Negativas",
    accent: "text-red-300",
    glow: "from-red-500/12",
    icon: (
      <svg className="h-4 w-4 text-red-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  {
    key: "unreviewed" as const,
    label: "Sin revisar",
    accent: "text-violet-300",
    glow: "from-violet-500/14",
    icon: (
      <svg className="h-4 w-4 text-violet-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function getValue(key: (typeof cards)[number]["key"], stats: ReviewStats) {
  switch (key) {
    case "positives":
      return stats.positives;
    case "negatives":
      return stats.negatives;
    case "unreviewed":
      return stats.unreviewed;
    default:
      return stats.total;
  }
}

export function ResenasSummary({ stats, loading, onFilter, activeFilter = "all" }: ResenasSummaryProps) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        const Wrapper = onFilter ? "button" : "div";

        return (
          <Wrapper
            key={card.key}
            type={onFilter ? "button" : undefined}
            onClick={onFilter ? () => onFilter(card.key) : undefined}
            className={`nexo-card-surface ${summaryCard} text-left ${onFilter ? "nexo-card-clickable cursor-pointer" : ""} ${isActive ? "border-violet-400/25 ring-1 ring-inset ring-violet-400/15" : ""}`}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glow} to-transparent opacity-80`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                  {card.label}
                </p>
                {card.icon}
              </div>
              {loading ? (
                <div className="nexo-skeleton mt-3 h-9 w-20" />
              ) : (
                <AnimatedNumber
                  value={getValue(card.key, stats)}
                  decimals={0}
                  className={`mt-3 block font-mono text-[34px] font-light tabular-nums leading-none ${card.accent}`}
                />
              )}            </div>
          </Wrapper>
        );
      })}
    </section>
  );
}
