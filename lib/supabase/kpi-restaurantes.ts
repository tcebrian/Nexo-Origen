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
 * Normaliza tanto filas antiguas como el catálogo canónico.
 * Las métricas de periodo se rellenan después exclusivamente desde
 * nexo_reputation_period_metrics().
 */
export function normalizeKpiRow(row: Record<string, unknown>): KpiRestaurantRow {
  return {
    restaurante_id: toNumber(row.restaurante_id),
    restaurante: String(row.restaurante ?? ""),
    ciudad: String(row.ciudad ?? ""),
    marca: String(row.marca ?? ""),
    total_resenas: toNumber(row.total_resenas),
    media_total: toNumber(row.media_total),
    resenas_negativas: toNumber(row.resenas_negativas),
    resenas_positivas: toNumber(row.resenas_positivas),
    ultima_resena: row.ultima_resena ? String(row.ultima_resena) : null,
    estado: String(row.estado ?? ""),
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
 * Catálogo oficial de restaurantes para reputación.
 * Ya no depende de la vista legacy kpi_restaurantes.
 */
export async function fetchAllKpiRows(): Promise<KpiRestaurantRow[]> {
  noStore();

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_restaurant_catalog", {
    p_restaurant_ids: null,
  });

  if (error) {
    console.error("[fetchAllKpiRows] Error Supabase canonical catalog:", error.message, error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    normalizeKpiRow({
      ...(row as Record<string, unknown>),
      total_resenas: 0,
      media_total: 0,
      resenas_negativas: 0,
      resenas_positivas: 0,
      ultima_resena: null,
      estado: "",
    })
  );
}

/** Filas KPI ajustadas al periodo con métricas canónicas de Supabase. */
export async function fetchKpiForPeriod(query: PeriodQuery): Promise<KpiRestaurantRow[]> {
  const { loadPeriodData } = await import("./period-api");
  const { activeKpiRows } = await loadPeriodData(query.start, query.end);
  return activeKpiRows;
}

export function getWeightedAverage(rows: KpiRestaurantRow[]): number {
  let weightedSum = 0;
  let totalReviews = 0;

  for (const row of rows) {
    weightedSum += row.media_total * row.total_resenas;
    totalReviews += row.total_resenas;
  }

  if (totalReviews > 0) {
    return weightedSum / totalReviews;
  }

  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + row.media_total, 0) / rows.length;
}
