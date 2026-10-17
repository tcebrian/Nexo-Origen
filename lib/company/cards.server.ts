import "server-only";

import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import type { CompanyAccess } from "./access";
import { buildCompanyCards, defaultDashboardPeriod, type CompanyCard } from "./cards";

/**
 * Media global por empresa para la pantalla de selección. Usa EL MISMO motor canónico que el dashboard
 * (`nexo_reputation_period_metrics`, vía `fetchSupabaseCanonicalReputationMetrics`) y el mismo catálogo de
 * restaurantes, filtrado por empresa. El valor es `network_media_exacta` de esa llamada: la media ponderada por
 * reseñas de todos los restaurantes de la empresa, no una media de medias.
 */
export async function loadCompanyCards(access: Pick<CompanyAccess, "companies" | "restaurantIdsByCompany">): Promise<CompanyCard[]> {
  const catalog = await fetchAllKpiRows().catch((error) => {
    console.error("[company] catalog failed", error instanceof Error ? error.message : "unknown");
    return [];
  });

  return buildCompanyCards({
    access,
    catalogIds: new Set(catalog.map((row) => row.restaurante_id)),
    period: defaultDashboardPeriod(new Date()),
    async fetchNetworkAverage(restaurantIds, period) {
      const rows = await fetchSupabaseCanonicalReputationMetrics(period.startKey, period.endKey, restaurantIds);
      const first = rows[0];
      if (!first || Number(first.network_total_resenas) <= 0) return null;
      const average = Number(first.network_media_exacta);
      return Number.isFinite(average) ? average : null;
    },
    onError: (company) => console.error(`[company] average failed companyId=${company.id}`),
  });
}
