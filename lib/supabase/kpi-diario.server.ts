import "server-only";

import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import type { KpiDiarioRow } from "./kpi-diario";

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(row: Record<string, unknown>): KpiDiarioRow {
  const fechaRaw = row.fecha;
  return {
    restaurante_id: toNumber(row.restaurante_id),
    fecha: toDateKey(String(fechaRaw ?? "")),
    total_resenas: toNumber(row.total_resenas),
    media: toNumber(row.media_exacta),
    negativas: toNumber(row.negativas),
    positivas: toNumber(row.positivas),
  };
}

/**
 * @deprecated The legacy kpi_diario table is no longer a source of truth.
 * Kept temporarily to avoid breaking old diagnostics.
 */
export async function getKpiDiarioTableCount(): Promise<number> {
  return 0;
}

/**
 * Canonical daily series calculated directly in Supabase from canonical reviews.
 * No reads from public.kpi_diario.
 */
export async function fetchKpiDiarioForPeriod(bounds: PeriodBounds): Promise<KpiDiarioRow[]> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_daily_metrics", {
    p_start: bounds.startKey,
    p_end: bounds.endKey,
    p_restaurant_ids: null,
  });

  if (error) {
    console.error("[fetchKpiDiarioForPeriod] Canonical daily metrics error:", error.message, error);
    return [];
  }

  return (data ?? [])
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter(
      (row) =>
        row.restaurante_id > 0 &&
        row.fecha &&
        isDateKeyInRange(row.fecha, bounds.startKey, bounds.endKey)
    );
}
