import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { enrichKpiRows } from "@/lib/supabase/restaurantes";
import { SUPABASE_VIEWS } from "@/lib/supabase/tables";
import { unstable_noStore as noStore } from "next/cache";

/** Vista de lectura en Supabase (no tabla). Solo SELECT; permiso vía GRANT a anon. */
const KPI_RESTAURANTES_VIEW = SUPABASE_VIEWS.kpi_restaurantes;

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
};

export type PeriodQuery = {
  start: Date;
  end: Date;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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
  };
}

/** @deprecated Usar isDateKeyInRange de lib/dates/period */
export function isInDateRange(dateValue: string | null, start: Date, end: Date): boolean {
  return isDateKeyInRange(dateValue, toDateKey(start), toDateKey(end));
}

export function filterKpiByPeriod(rows: KpiRestaurantRow[], bounds: PeriodBounds): KpiRestaurantRow[] {
  return rows.filter((row) => isDateKeyInRange(row.ultima_resena, bounds.startKey, bounds.endKey));
}

/** Lee el snapshot de cada restaurante desde la vista `kpi_restaurantes`. */
export async function fetchAllKpiRows(): Promise<KpiRestaurantRow[]> {
  noStore();

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.from(KPI_RESTAURANTES_VIEW).select("*");

  if (error) {
    console.error("[fetchAllKpiRows] Error Supabase:", error.message, error);
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) => normalizeKpiRow(row as Record<string, unknown>));
  return enrichKpiRows(rows);
}

/** Filas KPI ajustadas al periodo (métricas de resenas reales si existen). */
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
