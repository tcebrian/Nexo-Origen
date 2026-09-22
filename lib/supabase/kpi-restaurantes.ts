import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { fetchMarcasMap } from "@/lib/supabase/marcas";
import { classifyMediaStatus } from "@/lib/review-metrics";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Compatibility DTO used across Nexo.
 *
 * IMPORTANT: despite the historical name, this is no longer loaded from the
 * legacy kpi_restaurantes view. Catalog metadata comes from restaurantes +
 * marcas; period metrics come from nexo_reputation_period_metrics().
 */
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

/** @deprecated Usar isDateKeyInRange de lib/dates/period */
export function isInDateRange(dateValue: string | null, start: Date, end: Date): boolean {
  return isDateKeyInRange(dateValue, toDateKey(start), toDateKey(end));
}

export function filterKpiByPeriod(rows: KpiRestaurantRow[], bounds: PeriodBounds): KpiRestaurantRow[] {
  return rows.filter((row) => isDateKeyInRange(row.ultima_resena, bounds.startKey, bounds.endKey));
}

/**
 * Canonical restaurant catalog.
 * No derived reputation KPI view is involved.
 */
export async function fetchAllKpiRows(): Promise<KpiRestaurantRow[]> {
  noStore();

  const client = await getSupabaseDataClientForServer();
  const [restaurantsResult, marcas] = await Promise.all([
    client
      .from("restaurantes")
      .select("id,nombre,ciudad,marca_id,media_google,total_resenas_google,ultima_actualizacion_google,activo")
      .eq("activo", true)
      .order("nombre"),
    fetchMarcasMap(),
  ]);

  if (restaurantsResult.error) {
    console.error("[fetchAllKpiRows] Error Supabase:", restaurantsResult.error.message);
    throw new Error(restaurantsResult.error.message);
  }

  return (restaurantsResult.data ?? []).map((row) => {
    const mediaGoogle =
      row.media_google != null && Number.isFinite(Number(row.media_google))
        ? Number(row.media_google)
        : null;
    const totalGoogle =
      row.total_resenas_google != null && Number.isFinite(Number(row.total_resenas_google))
        ? Number(row.total_resenas_google)
        : null;
    const media = mediaGoogle ?? 0;
    const total = totalGoogle ?? 0;
    const status = classifyMediaStatus(media, total > 0);

    return {
      restaurante_id: Number(row.id),
      restaurante: String(row.nombre ?? ""),
      ciudad: String(row.ciudad ?? ""),
      marca: row.marca_id != null ? marcas.get(Number(row.marca_id)) ?? "" : "",
      // Lifetime fallback uses the public Google snapshot stored on restaurantes.
      // Period values are overwritten by metricsToKpiRow with the canonical SQL result.
      total_resenas: total,
      media_total: media,
      resenas_negativas: 0,
      resenas_positivas: 0,
      ultima_resena: row.ultima_actualizacion_google
        ? String(row.ultima_actualizacion_google)
        : null,
      estado: status.statusLabel,
      media_google: mediaGoogle,
      total_resenas_google: totalGoogle,
    };
  });
}

/** Filas ajustadas al periodo con métricas canónicas de Supabase. */
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

  if (totalReviews > 0) return weightedSum / totalReviews;
  return 0;
}
