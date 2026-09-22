import "server-only";

import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import type { KpiDiarioRow } from "./kpi-diario";

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCanonicalDailyRow(row: Record<string, unknown>): KpiDiarioRow {
  return {
    restaurante_id: toNumber(row.restaurante_id),
    fecha: toDateKey(String(row.fecha ?? "")),
    total_resenas: toNumber(row.total_resenas),
    media: toNumber(row.media_exacta),
    negativas: toNumber(row.negativas),
    positivas: toNumber(row.positivas),
  };
}

/**
 * Compatibilidad diagnóstica.
 * Ya no cuenta filas de la tabla legacy kpi_diario: cuenta reseñas canónicas.
 */
export async function getKpiDiarioTableCount(): Promise<number> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_canonical_reviews", {
    p_start: null,
    p_end: null,
    p_restaurant_ids: null,
  });

  if (error) {
    console.error("[getKpiDiarioTableCount] Error canonical:", error.message, error);
    return -1;
  }

  return (data ?? []).length;
}

/**
 * Serie diaria oficial de reputación.
 *
 * El nombre se mantiene temporalmente por compatibilidad con la UI, pero la
 * fuente real es public.nexo_reputation_daily_metrics(...). La tabla legacy
 * public.kpi_diario ya no participa en los datos servidos por la web.
 *
 * Reglas canónicas:
 * - positivas: 4-5 estrellas
 * - neutras: 3 estrellas
 * - negativas: 1-2 estrellas
 * - media: sum(estrellas) / total_resenas
 */
export async function fetchKpiDiarioForPeriod(bounds: PeriodBounds): Promise<KpiDiarioRow[]> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_daily_metrics", {
    p_start: bounds.startKey,
    p_end: bounds.endKey,
    p_restaurant_ids: null,
  });

  if (error) {
    console.error(
      "[fetchKpiDiarioForPeriod] Error Supabase canonical daily metrics:",
      error.message,
      error
    );
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => normalizeCanonicalDailyRow(row))
    .filter(
      (row: KpiDiarioRow) =>
        row.restaurante_id > 0 &&
        row.fecha &&
        isDateKeyInRange(row.fecha, bounds.startKey, bounds.endKey)
    );
}
