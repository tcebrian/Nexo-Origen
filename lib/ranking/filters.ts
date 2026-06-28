import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { RankingFilters, RankingRecord, RankingView } from "./types";

export function filterRankingRecords(records: RankingRecord[], filters: RankingFilters) {
  if (filters.brand === "todos") return records;
  return records.filter((r) => r.brand === filters.brand);
}

function mvpSummary(mvp: RankingRecord) {
  return mvp.restaurant;
}

function buildInsight() {
  return IA_NO_DATA;
}

export function buildRankingView(records: RankingRecord[]): RankingView {
  const sortedByMedia = [...records].sort((a, b) => b.media - a.media);
  const sortedByImprovement = [...records]
    .filter((r) => r.mediaChange > 0)
    .sort((a, b) => b.mediaChange - a.mediaChange);
  const sortedByRisk = [...records]
    .filter((r) => r.mediaChange < 0)
    .sort((a, b) => a.mediaChange - b.mediaChange);
  const sortedByStreak = [...records]
    .filter((r) => r.monthsAboveTarget > 0)
    .sort((a, b) => b.monthsAboveTarget - a.monthsAboveTarget);

  const mvp = sortedByMedia[0] ?? records[0];

  return {
    mvp,
    mvpAiSummary: mvp ? mvpSummary(mvp) : "",
    topPerformers: sortedByMedia.slice(0, 5),
    mostImproved: sortedByImprovement.slice(0, 3),
    highestRisk: sortedByRisk.slice(0, 3),
    hallOfFame: sortedByStreak.slice(0, 3),
    aiInsight: buildInsight(),
  };
}

export function getBrandFilterOptions(): { value: RankingFilters["brand"]; label: string }[] {
  return [
    { value: "todos", label: "Todas las marcas" },
    { value: "bk", label: "Burger King" },
    { value: "pp", label: "Popeyes" },
    { value: "sg", label: "Santa Gloria" },
    { value: "ribs", label: "Ribs" },
    { value: "tv", label: "Taberna Volapie" },
    { value: "sibuya", label: "Sibuya" },
    { value: "th", label: "Tim Hortons" },
  ];
}

export function formatMediaChange(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function getMedal(position: number) {
  if (position === 0) return "🥇";
  if (position === 1) return "🥈";
  if (position === 2) return "🥉";
  return null;
}

export type { BrandId };
