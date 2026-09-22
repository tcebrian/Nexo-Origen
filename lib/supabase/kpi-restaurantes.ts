import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Legacy type name kept temporarily for compatibility with existing UI/report
 * mappers. The rows no longer come from public.kpi_restaurantes.
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

type RestaurantBaseRow = {
  id: number | string;
  nombre: string;
  ciudad: string | null;
  marca_id: number | string | null;
  media_google: number | string | null;
  total_resenas_google: number | string | null;
};

type BrandRow = {
  id: number | string;
  nombre: string;
};

type LifetimeMetricRow = {
  restaurante_id: number | string;
  total_resenas: number | string;
  media_exacta: number | string;
  positivas: number | string;
  negativas: number | string;
  ultima_resena: string | null;
  operational_status: string;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function estadoFromOperational(value: string | undefined): string {
  if (value === "on_target") return "Óptimo";
  if (value === "critical") return "Crítico";
  return "En riesgo";
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
 * Catálogo oficial de restaurantes:
 * - identidad/meta: public.restaurantes + public.marcas
 * - snapshot histórico derivado: public.nexo_reputation_period_metrics(...)
 *
 * public.kpi_restaurantes is intentionally not queried anymore.
 */
export async function fetchAllKpiRows(): Promise<KpiRestaurantRow[]> {
  noStore();

  const client = await getSupabaseDataClientForServer();
  const [{ data: restaurants, error: restaurantsError }, { data: brands, error: brandsError }] =
    await Promise.all([
      client
        .from("restaurantes")
        .select("id,nombre,ciudad,marca_id,media_google,total_resenas_google")
        .eq("activo", true)
        .order("nombre"),
      client.from("marcas").select("id,nombre"),
    ]);

  if (restaurantsError) throw new Error(restaurantsError.message);
  if (brandsError) throw new Error(brandsError.message);

  const restaurantRows = (restaurants ?? []) as RestaurantBaseRow[];
  const brandRows = (brands ?? []) as BrandRow[];
  const brandById = new Map(brandRows.map((row) => [toNumber(row.id), row.nombre]));
  const restaurantIds = restaurantRows.map((row) => toNumber(row.id));

  let lifetimeRows: LifetimeMetricRow[] = [];
  if (restaurantIds.length > 0) {
    const { data, error } = await client.rpc("nexo_reputation_period_metrics", {
      p_start: "1900-01-01",
      p_end: "2999-12-31",
      p_restaurant_ids: restaurantIds,
    });
    if (error) throw new Error(error.message);
    lifetimeRows = (data ?? []) as LifetimeMetricRow[];
  }

  const lifetimeById = new Map(
    lifetimeRows.map((row) => [toNumber(row.restaurante_id), row])
  );

  return restaurantRows.map((restaurant) => {
    const id = toNumber(restaurant.id);
    const lifetime = lifetimeById.get(id);

    return {
      restaurante_id: id,
      restaurante: restaurant.nombre,
      ciudad: restaurant.ciudad ?? "",
      marca:
        restaurant.marca_id != null
          ? brandById.get(toNumber(restaurant.marca_id)) ?? ""
          : "",
      total_resenas: lifetime ? toNumber(lifetime.total_resenas) : 0,
      media_total: lifetime ? toNumber(lifetime.media_exacta) : 0,
      resenas_negativas: lifetime ? toNumber(lifetime.negativas) : 0,
      resenas_positivas: lifetime ? toNumber(lifetime.positivas) : 0,
      ultima_resena: lifetime?.ultima_resena ?? null,
      estado: estadoFromOperational(lifetime?.operational_status),
      media_google: nullableNumber(restaurant.media_google),
      total_resenas_google: nullableNumber(restaurant.total_resenas_google),
    };
  });
}

/** Filas KPI ajustadas al periodo (métricas oficiales de Supabase). */
export async function fetchKpiForPeriod(query: PeriodQuery): Promise<KpiRestaurantRow[]> {
  const { loadPeriodData } = await import("./period-api");
  const { activeKpiRows } = await loadPeriodData(query.start, query.end);
  return activeKpiRows;
}

/** @deprecated Las agregaciones oficiales deben venir de Supabase. */
export function getWeightedAverage(rows: KpiRestaurantRow[]): number {
  const totalReviews = rows.reduce((sum, row) => sum + row.total_resenas, 0);
  if (totalReviews <= 0) return 0;
  return (
    rows.reduce((sum, row) => sum + row.media_total * row.total_resenas, 0) /
    totalReviews
  );
}
