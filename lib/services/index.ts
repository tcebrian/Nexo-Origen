import { getAlertsRepository } from "@/lib/alerts/repository";
import { buildPreventView, filterPreventRecords } from "@/lib/prevent/filters";
import { getPreventRepository } from "@/lib/prevent/repository";
import { buildRankingView, filterRankingRecords } from "@/lib/ranking/filters";
import { getRankingRepository } from "@/lib/ranking/repository";
import { getReportsRepository } from "@/lib/reports/repository";
import { getRestaurantsRepository } from "@/lib/restaurants/repository";
import { getReviewsRepository } from "@/lib/reviews/repository";
import { buildTalentoPageView } from "@/lib/talento/filters";
import { getTalentoRepository } from "@/lib/talento/repository";

export type ServiceQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

/** Restaurantes operativos de la red. */
export async function getRestaurants(query: ServiceQuery) {
  const repo = await getRestaurantsRepository();
  return repo.listOperational({
    tenantId: query.tenantId,
    start: query.start,
    end: query.end,
  });
}

/** Reseñas del periodo. */
export async function getReviews(query: ServiceQuery) {
  const repo = await getReviewsRepository();
  return repo.list({
    tenantId: query.tenantId,
    start: query.start,
    end: query.end,
  });
}

/** Alertas / incidencias activas. */
export async function getAlerts(query: ServiceQuery) {
  const repo = await getAlertsRepository();
  const [alerts, resolvedThisWeek] = await Promise.all([
    repo.list(query),
    repo.resolvedCountThisWeek(),
  ]);
  return { alerts, resolvedThisWeek };
}

/** Ranking de restaurantes. */
export async function getRanking(query: ServiceQuery, brand: "todos" | string = "todos") {
  const repo = await getRankingRepository();
  const entries = await repo.list(query);
  const filtered = filterRankingRecords(entries, { brand: brand as "todos" });
  return buildRankingView(filtered);
}

/** Datos Nexo Prevent. */
export async function getPreventData(query: ServiceQuery, brand: "todas" | string = "todas") {
  const repo = await getPreventRepository();
  const records = await repo.list(query);
  const filtered = filterPreventRecords(records, { brand: brand as "todas" });
  return buildPreventView(filtered);
}

/** Informes ejecutivos. */
export async function getReports(query: ServiceQuery) {
  const repo = await getReportsRepository();
  const [latest, library, automations] = await Promise.all([
    repo.getLatest(query),
    repo.listLibrary(query),
    repo.listAutomations(),
  ]);
  return { latest, library, automations };
}

/** Menciones de talento / empleados. */
export async function getTalentMentions(query: ServiceQuery, brand: "todas" | string = "todas") {
  const repo = await getTalentoRepository();
  const payload = await repo.listEmployees(query);
  return buildTalentoPageView(
    payload.employees,
    {
      brand: brand as "todas",
      restaurant: "todos",
    },
    payload.summaryTrends
  );
}

export { getDashboardOverview, getDashboardOverview as getDashboardSummary } from "./dashboard";
export type { DashboardOverview } from "./dashboard";
