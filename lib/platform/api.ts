/**
 * Fachada de datos de plataforma — preparada para Supabase.
 * Los consumidores deben usar estas funciones en lugar de importar repos directamente.
 */

import { getAlertsRepository } from "@/lib/alerts/repository";
import { getPreventRepository } from "@/lib/prevent/repository";
import { getRankingRepository } from "@/lib/ranking/repository";
import { getReportsRepository } from "@/lib/reports/repository";
import { getRestaurantsRepository } from "@/lib/restaurants/repository";
import { getReviewsRepository } from "@/lib/reviews/repository";
import { getTalentoRepository } from "@/lib/talento/repository";
import { getDashboardOverview } from "@/lib/services/dashboard";
export type PlatformQuery = {
  tenantId?: string;
  start: Date;
  end: Date;
};

const DEFAULT_TENANT = "grupo-hambar";

function withTenant(query: PlatformQuery) {
  return { tenantId: query.tenantId ?? DEFAULT_TENANT, start: query.start, end: query.end };
}

export async function getDashboardSummary(query: PlatformQuery) {
  return getDashboardOverview(withTenant(query));
}

export async function getRestaurants(query: PlatformQuery) {
  const repo = await getRestaurantsRepository();
  return repo.listOperational(withTenant(query));
}

export async function getReviews(query: PlatformQuery) {
  const repo = await getReviewsRepository();
  return repo.list(withTenant(query));
}

export async function getAlerts(query: PlatformQuery) {
  const repo = await getAlertsRepository();
  return repo.list(withTenant(query));
}

export async function getPreventData(query: PlatformQuery) {
  const repo = await getPreventRepository();
  return repo.list(withTenant(query));
}

export async function getRanking(query: PlatformQuery) {
  const repo = await getRankingRepository();
  return repo.list(withTenant(query));
}

export async function getReports(query: PlatformQuery) {
  const repo = await getReportsRepository();
  const q = withTenant(query);
  const [latest, library, automations] = await Promise.all([
    repo.getLatest(q),
    repo.listLibrary(q),
    repo.listAutomations(),
  ]);
  return { latest, library, automations };
}

export async function getTalentData(query: PlatformQuery) {
  const repo = await getTalentoRepository();
  return repo.listEmployees(withTenant(query));
}
