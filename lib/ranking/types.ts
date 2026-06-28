import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type RankingRecord = {
  id: string;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  media: number;
  reviews: number;
  negatives: number;
  activeAlerts: number;
  criticalAlerts: number;
  mediaChange: number;
  monthsAboveTarget: number;
  sparkline: number[];
};

export type RankingView = {
  mvp: RankingRecord;
  mvpAiSummary: string;
  topPerformers: RankingRecord[];
  mostImproved: RankingRecord[];
  highestRisk: RankingRecord[];
  hallOfFame: RankingRecord[];
  aiInsight: string;
};

export type RankingFilters = {
  brand: "todos" | BrandId;
};

export type DateRange = {
  start: Date;
  end: Date;
};
