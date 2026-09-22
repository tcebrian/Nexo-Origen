import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { unstable_noStore as noStore } from "next/cache";

export type KpiRestaurantRow = {
  restaurante_id: number;
  restaurante: string;
  ciudad: string;
  marca: string;
  total_resenas: number;
  media_total: number;
  resenas_negativas: number;
  resenas_positivas: number;
  ultima_resena: string | null;
  estado: string;
  media_google: number | null;
  total_resenas_google: number | null;
};

export type PeriodQuery = {
  start: Date;
  end: Date;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compatibility row for the existing UI/report layer.
 *
 * IMPORTANT: period reputation numbers are intentionally zero here.
 * They are filled later from public.nexo_reputation_period_metrics(...).
 * This function is metadata only and no longer reads kpi_restaurantes.
 */
export function normalizeKpiRow(row: Record<string, unknown>): KpiRestaurantRow {
  return {
    restaurante_id: toNumber(row.restaurante_id),
    restaurante: String(row.restaurante ?? ""),
    ciudad: String(row.ciudad ?? ""),
    marca: String(row.marca ?? ""),
    total_resenas: 0,
    media_total: 0,
    resenas_negativas: 0,
    resenas_positivas: 0,
    ultima_resena: row.ultima_actualizacion_google
      ? String(row.ultima_actualizacion_google)
      : null,
    estado: "En riesgo",
    media_google: nullableNumber(row.media_google),
    total_resenas_google: nullableNumber(row.total_resenas_google),
  };
}

/** @deprecated Usar isDateKeyInRange de lib/dates/period */
export function isInDateRange(dateValue: string | null, start: Date, end: Date): boolean {
  return isDateKeyInRange(dateValue, toDateKey(start), toDateKey(end));
}

export function filterKpiByPeriod(rows: KpiRestaurantRow[], bounds: PeriodBounds): KpiRestaurantRow[] {
  return rows.filter((row) => isDateKeyInRange(row.ultima_resena, bounds.startKey, bounds.endKey));
}

/**
 * Canonical restaurant metadata.
 * Reads restaurantes + marcas + empresas through a service-role-only Supabase RPC.
 * No KPI calculation is performed here.
 */
export async function fetchAllKpiRows(): Promise<KpiRestaurantRow[]> {
  noStore();

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_restaurant_catalog", {
    p_restaurant_ids: null,
  });

  if (error) {
    console.error("[fetchAllKpiRows] Canonical catalog error:", error.message, error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    normalizeKpiRow(row as Record<string, unknown>)
  );
}

/** Filas ajustadas al periodo con métricas oficiales de Supabase. */
export async function fetchKpiForPeriod(query: PeriodQuery): Promise<KpiRestaurantRow[]> {
  const { loadPeriodData } = await import("./period-api");
  const { activeKpiRows } = await loadPeriodData(query.start, query.end);
  return activeKpiRows;
}

/**
 * Legacy helper kept only for source compatibility.
 * Do not use this to calculate official network KPIs.
 */
export function getWeightedAverage(rows: KpiRestaurantRow[]): number {
  let weightedSum = 0;
  let totalReviews = 0;

  for (const row of rows) {
    weightedSum += row.media_total * row.total_resenas;
    totalReviews += row.total_resenas;
  }

  if (totalReviews > 0) return weightedSum / totalReviews;
  return 0;
}
