import type { TalentoTrendItem } from "@/lib/talento/types";
import { EmployeeIllustrationAvatar } from "./employee-illustration-avatar";
import { TalentoSectionHeader } from "./talento-section-header";
import { TalentoSparkline } from "./talento-sparkline";
import {
  listRowCard,
  talentoPanel,
  talentoPanelInner,
  talentoPanelPad,
  trendDown,
  trendUp,
} from "./ui/talento-styles";

type TalentoTrendsProps = {
  items: TalentoTrendItem[];
};

export function TalentoTrends({ items }: TalentoTrendsProps) {
  return (
    <section className={`${talentoPanel} ${talentoPanelPad} flex h-full flex-col`}>
      <div className={talentoPanelInner} />
      <TalentoSectionHeader
        kicker="Evolución"
        title="Tendencias de talento"
        description="Variación de menciones y sentimiento vs. periodo anterior."
      />

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] px-6 py-12 text-center">
          <p className="text-[13px] text-gray-500">Sin tendencias destacadas.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const toneClass =
              item.direction === "up" ? trendUp : item.direction === "down" ? trendDown : "text-gray-400";
            const arrow = item.direction === "up" ? "↑" : item.direction === "down" ? "↓" : "→";

            return (
              <li key={item.employee.id} className={listRowCard}>
                <EmployeeIllustrationAvatar seed={item.employee.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{item.employee.name}</p>
                  <p className={`mt-0.5 text-[12px] font-semibold tabular-nums ${toneClass}`}>
                    <span className="mr-1 opacity-70">{arrow}</span>
                    {item.value}
                  </p>
                  <p className="text-[10px] text-gray-600">{item.label}</p>
                </div>
                <TalentoSparkline
                  values={item.sparkline}
                  positive={item.direction !== "down"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
