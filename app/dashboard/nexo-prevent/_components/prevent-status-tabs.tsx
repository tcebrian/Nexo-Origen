"use client";

import type { PreventNetworkSummary, PreventStatus } from "@/lib/prevent/types";

export type PreventTab = PreventStatus | "todos";

type PreventStatusTabsProps = {
  summary: PreventNetworkSummary;
  activeTab: PreventTab;
  onTabChange: (tab: PreventTab) => void;
};

const tabs: { key: PreventTab; label: string; count: (s: PreventNetworkSummary) => number }[] = [
  { key: "fuera_objetivo", label: "Necesitan actuación", count: (s) => s.outsideGoalCount },
  { key: "vigilancia", label: "En vigilancia", count: (s) => s.watchCount },
  { key: "protegido", label: "Protegidos", count: (s) => s.protectedCount },
];

export function PreventStatusTabs({ summary, activeTab, onTabChange }: PreventStatusTabsProps) {
  return (
    <div className="mb-5 flex flex-wrap gap-2 border-b border-[var(--nexo-border)] pb-4">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`rounded-xl border px-4 py-2.5 text-[13px] font-medium transition ${
              active
                ? "border-violet-400/30 bg-violet-500/15 text-violet-100 shadow-[0_0_24px_rgba(124,58,237,0.15)]"
                : "border-[var(--nexo-border)] bg-[var(--nexo-inset)]/50 text-[var(--nexo-text-secondary)] hover:border-[var(--nexo-border-strong)] hover:text-[var(--nexo-text)]"
            }`}
          >
            {tab.label}
            <span className="ml-2 font-mono text-[12px] tabular-nums opacity-80">({tab.count(summary)})</span>
          </button>
        );
      })}
    </div>
  );
}
