import "server-only";

import { buildAlertsFromResenas } from "@/lib/alerts/build-from-resenas";
import { getUrgentAlerts } from "@/lib/alerts/filters";
import { createRestaurantsRepository } from "@/lib/restaurants/restaurants-repository-shared";
import { loadPeriodDataServer } from "@/lib/supabase/period-api.server";
import { getTranslationsForResenas } from "@/lib/translate/resena-translations";
import type { DashboardOverview } from "./dashboard";
import { buildRecentActivity } from "./dashboard";

export async function getDashboardOverviewServer(query: {
  tenantId: string;
  start: Date;
  end: Date;
}): Promise<DashboardOverview> {
  const restaurantsRepo = createRestaurantsRepository(loadPeriodDataServer);

  const [restaurants, period] = await Promise.all([
    restaurantsRepo.listOperational(query),
    loadPeriodDataServer(query.start, query.end),
  ]);

  const translationsByResenaId = await getTranslationsForResenas(period.resenas);
  const alerts = buildAlertsFromResenas(
    period.resenas,
    period.aggregates.byRestaurante,
    period.analisisByResenaId,
    translationsByResenaId
  );

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
