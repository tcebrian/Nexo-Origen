import "server-only";

import { filterKpiRowsByScope } from "@/lib/auth/data-scope";
import type { UserScope } from "@/lib/auth/types";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import { buildNetworkSummaryFromPayload } from "./build";
import { NETWORK_REPORT_GROUPS, selectNetworkReportRestaurantIds, type NetworkReportGroupId } from "./brand-groups";
import type { NetworkSummaryData, NetworkSummaryPayload } from "./types";

/**
 * Informe de red de un grupo de marcas para un periodo.
 *
 * Todo el cálculo (medias, porcentajes, objetivo por marca, estados, motivos)
 * lo hace Supabase en public.nexo_network_summary_payload. Aquí solo se decide
 * QUÉ restaurantes componen el grupo (empresa + marcas + filtro de ciudad de
 * brand-groups.ts) y se pide el resultado. La empresa es obligatoria: el
 * informe de una marca nunca mezcla restaurantes de otro cliente. Sin plan B: si Supabase falla, se
 * lanza el error en vez de servir cifras calculadas por otro camino.
 */
export async function fetchNetworkSummaryReport(
  groupId: NetworkReportGroupId,
  period: { start: Date; end: Date; startKey: string; endKey: string },
  scope?: UserScope
): Promise<NetworkSummaryData> {
  const group = NETWORK_REPORT_GROUPS[groupId];

  const catalog = await fetchAllKpiRows();
  const scoped = scope ? filterKpiRowsByScope(catalog, scope) : catalog;
  const restaurantIds = selectNetworkReportRestaurantIds(group, scoped, marcaToBrandId);

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_network_summary_payload", {
    p_start: period.startKey,
    p_end: period.endKey,
    p_restaurant_ids: restaurantIds,
    p_negative_max_stars: group.negativeMaxStars ?? 3,
  });

  if (error) {
    throw new Error(`No se pudo calcular el informe de red en Supabase: ${error.message}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Supabase no devolvió el informe de red.");
  }

  return buildNetworkSummaryFromPayload(group, data as NetworkSummaryPayload, period);
}
