import { getPeriodBounds, getPeriodBoundsFromDates, periodBoundsToQuery } from "@/lib/date-utils";
import type { PeriodBounds } from "@/lib/dates/period";
import {
  buildPeriodMetrics,
  dedupeResenas,
  metricsToKpiRow,
  type PeriodMetricsResult,
  type RestaurantPeriodMetrics,
} from "@/lib/review-metrics";
import { resolveDailyNetworkSeries } from "@/lib/supabase/chart-series";
import {
  filterKpiRowsByScope,
  filterResenasByScope,
} from "@/lib/auth/data-scope";
import type { UserScope } from "@/lib/auth/types";
import type { KpiDiarioRow, DailyNetworkPoint } from "@/lib/supabase/kpi-diario";
import { fetchAllKpiRowsCached } from "@/lib/cache/kpi-catalog-cache";
import { fetchAllKpiRows, type KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { logAnalisisIaJoinStats } from "@/lib/supabase/analisis-ia";
import { fetchAnalisisIaForResenas } from "@/lib/supabase/analisis-ia.server";
import { fetchCanonicalReviewImpacts } from "@/lib/supabase/review-impact.server";
import type { MediaImpactResult } from "@/lib/reviews/media-impact";
import {
  compareReputationMetricResults,
  fetchSupabaseCanonicalMotives,
  fetchSupabaseCanonicalReputationMetrics,
  mapSupabaseCanonicalMetrics,
  recordMetricValidationMismatch,
} from "@/lib/supabase/reputation-metrics.server";

export type LoadSnapshotOptions = {
  /** Omitir analisis_ia (más rápido en inicio del dashboard). */
  includeAnalisis?: boolean;
  /** Compatibilidad legacy: ya no consulta dashboard_kpis. */
  skipDashboardKpis?: boolean;
};

export type NexoPeriodSnapshot = {
  bounds: PeriodBounds;
  fetchedAt: Date;
  catalog: KpiRestaurantRow[];
  resenas: ResenaRow[];
  /** Compatibilidad API. Siempre vacío: kpi_diario ya no es fuente de Nexo. */
  kpiDiario: KpiDiarioRow[];
  metrics: PeriodMetricsResult;
  activeKpiRows: KpiRestaurantRow[];
  dailySeries: DailyNetworkPoint[];
  chartPending: boolean;
  chartSource: "resenas" | "empty";
  /** Compatibilidad API. dashboard_kpis ya no participa. */
  dashboardKpis: null;
  analisisByResenaId: AnalisisIaIndex;
  reviewImpactsByResenaId: Record<string, MediaImpactResult>;
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
 * - catálogo: restaurantes + marcas
 * - hechos: resenas
 * - KPI numéricos: public.nexo_reputation_period_metrics(...)
 * - motivos/IA: tablas base
 *
 * No lee dashboard_kpis, kpi_restaurantes ni kpi_diario.
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
    safeFetch("catalog", () => fetchAllKpiRowsCached(fetchAllKpiRows), [] as KpiRestaurantRow[]),
    safeFetch(
      "resenas",
      () =>
        fetchResenasForPeriodServer(
          { start: bounds.start, end: bounds.end },
          { queryBounds: query }
        ),
      [] as ResenaRow[]
    ),
  ]);

  const catalog = scope ? filterKpiRowsByScope(catalogRaw, scope) : catalogRaw;
  const resenas = dedupeResenas(
    scope ? filterResenasByScope(rawResenas, scope) : rawResenas
  );

  const reviewImpactsByResenaId = await safeFetch(
    "review_impacts",
    () => fetchCanonicalReviewImpacts(resenas),
    {} as Record<string, MediaImpactResult>
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

  // Shadow comparator only: never served to interfaces.
  const legacyMetrics = buildPeriodMetrics({
    catalog,
    resenas,
    kpiDiario: [],
    analisisByResenaId,
  });

  const restaurantIds = catalog.map((row) => row.restaurante_id);
  const [canonicalRows, canonicalMotives] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(
      bounds.startKey,
      bounds.endKey,
      restaurantIds
    ),
    fetchSupabaseCanonicalMotives(
      bounds.startKey,
      bounds.endKey,
      restaurantIds
    ),
  ]);

  const metrics = mapSupabaseCanonicalMetrics({
    catalog,
    rows: canonicalRows,
    problemDistribution: canonicalMotives,
  });

  const mismatches = compareReputationMetricResults(metrics, legacyMetrics);
  if (mismatches.length > 0) {
    console.error(
      `[canonical-reputation] Supabase/shadow mismatch for ${bounds.startKey}..${bounds.endKey}`,
      mismatches.slice(0, 20)
    );
    await recordMetricValidationMismatch({
      startKey: bounds.startKey,
      endKey: bounds.endKey,
      restaurantCount: catalog.length,
      mismatches,
    });
  }

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
          ultima_resena: null,
          estado: "En riesgo",
        };
  });

  const { series: dailySeries, source: chartSource } = resolveDailyNetworkSeries([], resenas);

  return {
    bounds,
    fetchedAt: new Date(),
    catalog,
    resenas,
    kpiDiario: [],
    metrics,
    activeKpiRows,
    dailySeries,
    chartPending: dailySeries.length === 0,
    chartSource,
    dashboardKpis: null,
    analisisByResenaId,
    reviewImpactsByResenaId,
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
        ultimaResena: null,
      } satisfies RestaurantPeriodMetrics)
  );
}
