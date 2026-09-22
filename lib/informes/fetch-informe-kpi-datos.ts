import "server-only";

import { getInformeQueryBounds } from "@/lib/informes/informe-kpi-utils";
import type { InformeKpiDatos } from "@/lib/informes/types";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * KPI del informe desde la única fuente numérica oficial:
 * public.nexo_reputation_period_metrics(...).
 */
export async function fetchInformeKpiDatos(
  startKey?: string,
  endKey?: string
): Promise<InformeKpiDatos> {
  const { bounds } = getInformeQueryBounds(startKey, endKey, 30);
  const catalog = await fetchAllKpiRows();
  const rows = await fetchSupabaseCanonicalReputationMetrics(
    bounds.startKey,
    bounds.endKey,
    catalog.map((row) => row.restaurante_id)
  );

  const network = rows[0];
  return {
    media: n(network?.network_media_exacta),
    resenas: n(network?.network_total_resenas),
    negativas: n(network?.network_negativas),
    restaurantes: rows.filter((row) => n(row.total_resenas) > 0).length,
  };
}
