/**
 * Fachada de datos de la plataforma.
 * Usar estas funciones desde páginas, API routes y server components.
 */
export {
  getRestaurants,
  getReviews,
  getAlerts,
  getRanking,
  getPreventData,
  getReports,
  getTalentMentions,
  getDashboardOverview,
  getDashboardSummary,
} from "@/lib/services";

export type { ServiceQuery, DashboardOverview } from "@/lib/services";

export { isSupabaseConfigured, assertSupabaseConfigured } from "@/lib/data-source";
