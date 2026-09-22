import "server-only";

import { getInformeQueryBounds } from "@/lib/informes/informe-kpi-utils";
import type { InformeKpiDatos } from "@/lib/informes/types";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";

/**
 * KPIs del informe desde la calculadora canónica de Supabase.
 * No recalcula medias ni porcentajes en Vercel.
 */
export async function fetchInformeKpiDatos(
  startKey?: string,
  endKey?: string
): Promise<InformeKpiDatos> {
  const { bounds } = getInformeQueryBounds(startKey, endKey, 30);
  const catalog = await fetchAllKpiRows();
  const ids = catalog.map((row) => row.restaurante_id);

  const rows = await fetchSupabaseCanonicalReputationMetrics(
    bounds.startKey,
    bounds.endKey,
    ids
  );
  const network = rows[0];

  return {
    media: Number(network?.network_media_exacta ?? 0),
    resenas: Number(network?.network_total_resenas ?? 0),
    negativas: Number(network?.network_negativas ?? 0),
    restaurantes: Number(network?.network_total_restaurantes ?? ids.length),
  };
}
