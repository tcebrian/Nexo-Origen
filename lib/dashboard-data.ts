import { getPeriodBounds, getPeriodBoundsFromDates, periodBoundsToQuery } from "@/lib/date-utils";
import type { PeriodBounds } from "@/lib/dates/period";
import {
  dedupeResenas,
  metricsToKpiRow,
  type NetworkPeriodMetrics,
  type PeriodMetricsResult,
  type RestaurantPeriodMetrics,
} from "@/lib/review-metrics";
import {
  filterKpiRowsByScope,
  filterResenasByScope,
} from "@/lib/auth/data-scope";
import type { UserScope } from "@/lib/auth/types";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import type { KpiDiarioRow, DailyNetworkPoint } from "@/lib/supabase/kpi-diario";
import { fetchAllKpiRowsCached } from "@/lib/cache/kpi-catalog-cache";
import { fetchAllKpiRows, type KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { logAnalisisIaJoinStats } from "@/lib/supabase/analisis-ia";
import { fetchAnalisisIaForResenas } from "@/lib/supabase/analisis-ia.server";
import {
  extractCanonicalNetworkAggregate,
  fetchSupabaseCanonicalDailyMetrics,
  fetchSupabaseCanonicalMotives,
  fetchSupabaseCanonicalReputationMetrics,
  fetchSupabaseReviewImpacts,
  mapSupabaseCanonicalMetrics,
  mapSupabaseMotivesToProblemDistribution,
} from "@/lib/supabase/reputation-metrics.server";

export type LoadSnapshotOptions = {
  /** Omitir analisis_ia (más rápido en inicio del dashboard). */
  includeAnalisis?: boolean;
  /** @deprecated Se conserva solo por compatibilidad. dashboard_kpis ya no se consulta. */
  skipDashboardKpis?: boolean;
};

export type NexoPeriodSnapshot = {
  bounds: PeriodBounds;
  fetchedAt: Date;
  catalog: KpiRestaurantRow[];
  resenas: ResenaRow[];
  /** Compatibilidad de tipo: ahora contiene la serie diaria CANÓNICA calculada por Supabase. */
  kpiDiario: KpiDiarioRow[];
  metrics: PeriodMetricsResult;
  activeKpiRows: KpiRestaurantRow[];
  dailySeries: DailyNetworkPoint[];
  chartPending: boolean;
  chartSource: "kpi_diario" | "resenas" | "empty";
  /** Legacy eliminado del flujo. Siempre null. */
  dashboardKpis: null;
  analisisByResenaId: AnalisisIaIndex;
  brandAggregates: Record<string, import("@/lib/supabase/period-types").PeriodNetworkAggregate>;
  problemDistributionByBrand: Record<string, import("@/lib/review-metrics").ProblemDistributionItem[]>;
};

async function safeFetch<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[loadNexoPeriodSnapshot] ${label}`, error);
    return fallback;
  }
}

/**
 * Capa única de datos del periodo.
 *
 * Fuente oficial:
 * - catálogo: restaurantes + marcas
 * - métricas: nexo_reputation_period_metrics(...)
 * - serie diaria: nexo_reputation_daily_metrics(...)
 * - motivos: nexo_reputation_motives_period(...)
 *
 * No consulta dashboard_kpis, kpi_diario ni kpi_restaurantes.
 */
export async function loadNexoPeriodSnapshot(
  startKey: string,
  endKey: string,
  scope?: UserScope,
  options?: LoadSnapshotOptions
): Promise<NexoPeriodSnapshot> {
  const includeAnalisis = options?.includeAnalisis ?? true;
  const bounds = getPeriodBounds(startKey, endKey);
  const query = periodBoundsToQuery(bounds);

  const [catalogRaw, rawResenas] = await Promise.all([
    fetchAllKpiRowsCached(fetchAllKpiRows),
    fetchResenasForPeriodServer(
      { start: bounds.start, end: bounds.end },
      { queryBounds: query }
    ),
  ]);

  const catalog = scope ? filterKpiRowsByScope(catalogRaw, scope) : catalogRaw;
  const resenas = dedupeResenas(
    scope ? filterResenasByScope(rawResenas, scope) : rawResenas
  );
  const restaurantIds = catalog.map((row) => row.restaurante_id);

  const [canonicalRows, canonicalDaily, motiveRows, impactByResenaId] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(
      bounds.startKey,
      bounds.endKey,
      restaurantIds
    ),
    fetchSupabaseCanonicalDailyMetrics(
      bounds.startKey,
      bounds.endKey,
      restaurantIds
    ),
    fetchSupabaseCanonicalMotives(
      bounds.startKey,
      bounds.endKey,
      restaurantIds
    ),
    fetchSupabaseReviewImpacts(resenas.map((row) => Number(row.id))),
  ]);

  const restaurantIdsByBrand = new Map<string, number[]>();
  for (const row of catalog) {
    const brand = marcaToBrandId(row.marca);
    const ids = restaurantIdsByBrand.get(brand) ?? [];
    ids.push(row.restaurante_id);
    restaurantIdsByBrand.set(brand, ids);
  }

  const brandEntries = await Promise.all(
    [...restaurantIdsByBrand.entries()].map(async ([brand, ids]) => {
      const [metricRows, brandMotiveRows] = await Promise.all([
        fetchSupabaseCanonicalReputationMetrics(
          bounds.startKey,
          bounds.endKey,
          ids
        ),
        fetchSupabaseCanonicalMotives(
          bounds.startKey,
          bounds.endKey,
          ids
        ),
      ]);

      return {
        brand,
        aggregate: extractCanonicalNetworkAggregate(metricRows, ids.length),
        motives: mapSupabaseMotivesToProblemDistribution(brandMotiveRows),
      };
    })
  );

  const brandAggregates = Object.fromEntries(
    brandEntries.map((entry) => [entry.brand, entry.aggregate])
  );
  const problemDistributionByBrand = Object.fromEntries(
    brandEntries.map((entry) => [entry.brand, entry.motives])
  );

  let analisisByResenaId: AnalisisIaIndex = new Map();
  if (includeAnalisis && resenas.length > 0) {
    analisisByResenaId = await safeFetch(
      "analisis_ia",
      () => fetchAnalisisIaForResenas(resenas),
      new Map() as AnalisisIaIndex
    );
    logAnalisisIaJoinStats(resenas, analisisByResenaId, "loadNexoPeriodSnapshot");
  }

  const problemDistribution = mapSupabaseMotivesToProblemDistribution(motiveRows);
  const metrics = mapSupabaseCanonicalMetrics({
    catalog,
    rows: canonicalRows,
    problemDistribution,
  });

  const activeKpiRows = catalog.map((row) => {
    const period = metrics.byRestaurante.get(row.restaurante_id);
    return period
      ? metricsToKpiRow(row, period)
      : {
          ...row,
          total_resenas: 0,
          media_total: 0,
          resenas_negativas: 0,
          resenas_positivas: 0,
          estado: "En riesgo",
        };
  });

  const dailySeries = canonicalDaily.networkSeries;
  const chartSource = dailySeries.length > 0 ? ("resenas" as const) : ("empty" as const);

  return {
    bounds,
    fetchedAt: new Date(),
    catalog,
    resenas,
    kpiDiario: canonicalDaily.rows,
    metrics,
    activeKpiRows,
    dailySeries,
    chartPending: dailySeries.length === 0,
    chartSource,
    dashboardKpis: null,
    analisisByResenaId,
    impactByResenaId,
    brandAggregates,
    problemDistributionByBrand,
  };
}

export async function loadNexoPeriodSnapshotFromDates(
  start: Date,
  end: Date,
  scope?: UserScope
) {
  const bounds = getPeriodBoundsFromDates(start, end);
  return loadNexoPeriodSnapshot(bounds.startKey, bounds.endKey, scope);
}

export function getRestaurantMetricsList(snapshot: NexoPeriodSnapshot): RestaurantPeriodMetrics[] {
  return snapshot.catalog.map(
    (row) =>
      snapshot.metrics.byRestaurante.get(row.restaurante_id) ??
      ({
        restauranteId: row.restaurante_id,
        restaurante: row.restaurante,
        ciudad: row.ciudad,
        marca: row.marca,
        brand: "bk" as const,
        slug: "",
        totalResenas: 0,
        media: 0,
        resenasPositivas: 0,
        resenasNegativas: 0,
        stars: { stars1: 0, stars2: 0, stars3: 0, stars4: 0, stars5: 0 },
        statusLabel: "En riesgo" as const,
        operationalStatus: "watch" as const,
        ultimaResena: row.ultima_resena,
      } satisfies RestaurantPeriodMetrics)
  );
}

/**
 * @deprecated dashboard_kpis ya no participa en el cálculo.
 * Se conserva como identidad mientras desaparecen imports legacy.
 */
export function mergeNetworkWithDashboardKpis(
  network: NetworkPeriodMetrics,
  _dashboardKpis: null
): NetworkPeriodMetrics {
  return network;
}
