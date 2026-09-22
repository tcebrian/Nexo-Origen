import "server-only";

import { resolveInformePeriod } from "@/lib/informes/informe-kpi-utils";
import type { InformeKpiDatos } from "@/lib/informes/types";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import {
  extractCanonicalNetworkAggregate,
  fetchSupabaseCanonicalReputationMetrics,
} from "@/lib/supabase/reputation-metrics.server";

/**
 * KPIs oficiales del informe.
 * La matemática la ejecuta public.nexo_reputation_period_metrics(...) en Supabase.
 */
export async function fetchInformeKpiDatos(
  startKey?: string,
  endKey?: string
): Promise<InformeKpiDatos> {
  const bounds = resolveInformePeriod(startKey, endKey, 30);
  const catalog = await fetchAllKpiRows();
  const restaurantIds = catalog.map((row) => row.restaurante_id);

  const rows = await fetchSupabaseCanonicalReputationMetrics(
    bounds.startKey,
    bounds.endKey,
    restaurantIds
  );
  const aggregate = extractCanonicalNetworkAggregate(
    rows,
    restaurantIds.length
  );

  return {
    media: aggregate.mediaGlobal,
    resenas: aggregate.totalResenas,
    negativas: aggregate.totalNegativas,
    restaurantes: aggregate.totalRestaurantes,
  };
}
