import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { getNetworkSummary } from "./metrics";
import type { RestaurantOperational } from "./types";

export type BrandSnapshot = {
  count: number;
  onTarget: number;
  onWatch: number;
  critical: number;
  avgMedia: string;
  avgProtection: number;
};

export function getBrandSnapshot(
  restaurants: RestaurantOperational[],
  brand: "todas" | BrandId
): BrandSnapshot {
  const items =
    brand === "todas" ? restaurants : restaurants.filter((r) => r.brand === brand);

  if (items.length === 0) {
    return {
      count: 0,
      onTarget: 0,
      onWatch: 0,
      critical: 0,
      avgMedia: "—",
      avgProtection: 0,
    };
  }

  const summary = getNetworkSummary(items);
  const periodReviews = items.reduce((sum, r) => sum + r.totalReviews, 0);
  const weightedMediaSum = items.reduce((sum, r) => sum + r.currentMedia * r.totalReviews, 0);
  const avgMedia = periodReviews > 0 ? weightedMediaSum / periodReviews : 0;
  const avgProtection = Math.round(
    items.reduce((sum, r) => sum + r.protectionLevel, 0) / items.length
  );

  return {
    count: items.length,
    onTarget: summary.onTarget,
    onWatch: summary.onWatch,
    critical: summary.critical,
    avgMedia: avgMedia.toFixed(2),
    avgProtection,
  };
}
