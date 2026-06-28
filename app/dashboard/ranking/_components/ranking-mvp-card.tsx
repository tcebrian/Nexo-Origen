"use client";

import Link from "next/link";
import { formatMediaChange } from "@/lib/ranking/filters";
import type { RankingRecord } from "@/lib/ranking/types";
import { MiniSparkline } from "../../_components/charts";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { insightBlock, metricPill, shell, textKicker } from "./ui/ranking-styles";

type RankingMvpCardProps = {
  mvp: RankingRecord;
  aiSummary: string;
};

const STATS = [
  { key: "reviews", label: "Reseñas", short: "Reseñas" },
  { key: "negatives", label: "Negativas", short: "Neg." },
  { key: "activeAlerts", label: "Alertas", short: "Alertas" },
  { key: "criticalAlerts", label: "Críticas", short: "Crít." },
] as const;

export function RankingMvpCard({ mvp, aiSummary }: RankingMvpCardProps) {
  const trendUp = mvp.mediaChange >= 0;
  const sparkValues =
    mvp.sparkline.length >= 2
      ? mvp.sparkline
      : mvp.sparkline.length === 1
        ? [mvp.sparkline[0], mvp.sparkline[0]]
        : [mvp.media, mvp.media];

  return (
    <Link
      href={`/dashboard/restaurantes/${mvp.restaurantSlug}`}
      className={`group relative block ${shell} overflow-hidden transition duration-[180ms] hover:border-[var(--nexo-border-strong)] hover:shadow-[var(--nexo-shadow-md)]`}
    >
      <div className="relative p-5 lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base" aria-hidden>
                🏆
              </span>
              <p className={`${textKicker} text-[var(--nexo-accent)]`}>MVP del mes</p>
            </div>

            <div className="mt-4 min-w-0">
              <RestaurantBrandLine
                brand={mvp.brand}
                name={mvp.restaurant}
                logoSize="sm"
                nameClassName="truncate text-xl font-semibold tracking-[-0.02em] text-[var(--nexo-text)] sm:text-2xl"
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="inline-flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tabular-nums text-[var(--nexo-text)] sm:text-3xl">
                    {mvp.media.toFixed(1)}
                  </span>
                  <span className="text-[var(--nexo-watch)]">★</span>
                </span>
                <span
                  className={`${metricPill} ${
                    trendUp
                      ? "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]"
                      : "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]"
                  }`}
                >
                  {formatMediaChange(mvp.mediaChange)} vs. anterior
                </span>
              </div>
            </div>
          </div>

          <div className={`flex shrink-0 items-center justify-center ${insightBlock} px-4 py-3 xl:ml-4`}>
            <MiniSparkline values={sparkValues} color="#7C3AED" width={112} height={40} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {STATS.map((stat) => {
            const value = mvp[stat.key];
            const isCritical = stat.key === "criticalAlerts";
            return (
              <div key={stat.key} className={`${insightBlock} px-3.5 py-3 sm:px-4`}>
                <p className={`${textKicker} sm:hidden`}>{stat.short}</p>
                <p className={`${textKicker} hidden sm:block`}>{stat.label}</p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums sm:mt-1.5 ${
                    isCritical && value > 0
                      ? "text-[var(--nexo-critical)]"
                      : isCritical
                        ? "text-[var(--nexo-success)]"
                        : "text-[var(--nexo-text)]"
                  }`}
                >
                  {typeof value === "number" ? value.toLocaleString("es-ES") : value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-[var(--nexo-radius)] border border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--nexo-text-secondary)]">
            <span className="mr-1.5 text-[var(--nexo-accent)]">✦</span>
            {aiSummary}
          </p>
        </div>
      </div>
    </Link>
  );
}
