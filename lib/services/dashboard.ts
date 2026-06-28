import { getUrgentAlerts } from "@/lib/alerts/filters";
import { getAlertsRepository } from "@/lib/alerts/repository";
import type { RestaurantAlert } from "@/lib/alerts/types";
import { getRestaurantsRepository } from "@/lib/restaurants/repository";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import { REPUTATION_TARGET } from "@/lib/status/unified";

export type DashboardOverview = {
  networkMedia: number;
  totalReviews: number;
  totalNegatives: number;
  onTarget: number;
  onWatch: number;
  critical: number;
  urgentAlerts: RestaurantAlert[];
  recentActivity: {
    id: string;
    restaurant: string;
    restaurantSlug: string;
    brand: RestaurantOperational["brand"];
    description: string;
    occurredAt: Date;
    type: "alert" | "review" | "improvement";
  }[];
  topPerformers: RestaurantOperational[];
  needsAttention: RestaurantOperational[];
};

export function buildRecentActivity(
  restaurants: RestaurantOperational[],
  alerts: RestaurantAlert[]
): DashboardOverview["recentActivity"] {
  const items: DashboardOverview["recentActivity"] = [];

  for (const alert of alerts.slice(0, 4)) {
    items.push({
      id: `alert-${alert.id}`,
      restaurant: alert.restaurant,
      restaurantSlug: alert.restaurantSlug,
      brand: alert.brand,
      description: alert.whatHappened,
      occurredAt: alert.detectedAt,
      type: "alert",
    });
  }

  const improving = [...restaurants]
    .filter((r) => r.trend === "up" && r.status === "on_target")
    .slice(0, 2);

  for (const r of improving) {
    items.push({
      id: `improve-${r.id}`,
      restaurant: r.name,
      restaurantSlug: r.slug,
      brand: r.brand,
      description: `Media ${r.currentMedia.toFixed(1)} · tendencia positiva`,
      occurredAt: r.lastReviewAt ? new Date(r.lastReviewAt) : new Date(),
      type: "improvement",
    });
  }

  return items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 6);
}

export async function getDashboardOverview(query: {
  tenantId: string;
  start: Date;
  end: Date;
}): Promise<DashboardOverview> {
  const restaurantsRepo = await getRestaurantsRepository();
  const alertsRepo = await getAlertsRepository();

  const [restaurants, alerts] = await Promise.all([
    restaurantsRepo.listOperational(query),
    alertsRepo.list(query),
  ]);

  const onTarget = restaurants.filter((r) => r.status === "on_target").length;
  const onWatch = restaurants.filter((r) => r.status === "watch").length;
  const critical = restaurants.filter((r) => r.status === "critical").length;

  const networkMedia =
    restaurants.length > 0
      ? restaurants.reduce((s, r) => s + r.currentMedia * r.totalReviews, 0) /
        Math.max(
          1,
          restaurants.reduce((s, r) => s + r.totalReviews, 0)
        )
      : 0;

  const totalReviews = restaurants.reduce((s, r) => s + r.totalReviews, 0);
  const totalNegatives = restaurants.reduce((s, r) => s + r.negativeReviews, 0);

  const urgentAlerts = getUrgentAlerts(alerts).slice(0, 4);

  const topPerformers = [...restaurants]
    .sort((a, b) => b.currentMedia - a.currentMedia)
    .slice(0, 5);

  const needsAttention = [...restaurants]
    .filter((r) => r.status !== "on_target")
    .sort((a, b) => a.currentMedia - b.currentMedia)
    .slice(0, 5);

  return {
    networkMedia,
    totalReviews,
    totalNegatives,
    onTarget,
    onWatch,
    critical,
    urgentAlerts,
    recentActivity: buildRecentActivity(restaurants, alerts),
    topPerformers,
    needsAttention,
  };
}

export { REPUTATION_TARGET };
