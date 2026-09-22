import { getPeriodBounds, getPeriodBoundsFromDates, periodBoundsToQuery } from "@/lib/date-utils";
import type { PeriodBounds } from "@/lib/dates/period";
import {
  buildPeriodMetrics,
  dedupeResenas,
  metricsToKpiRow,
  type NetworkPeriodMetrics,
  type PeriodMetricsResult,
  type RestaurantPeriodMetrics,
} from "@/lib/review-metrics";
import { resolveDailyNetworkSeries } from "@/lib/supabase/chart-series";
import {
  filterKpiDiarioByScope,
  filterKpiRowsByScope,
  filterResenasByScope,
} from "@/lib/auth/data-scope";
import type { UserScope } from "@/lib/auth/types";
import { fetchKpiDiarioForPeriod } from "@/lib/supabase/kpi-diario.server";
import type { KpiDiarioRow, DailyNetworkPoint } from "@/lib/supabase/kpi-diario";
import { fetchAllKpiRowsCached } from "@/lib/cache/kpi-catalog-cache";
import { fetchAllKpiRows, type KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { fetchDashboardKpisForPeriod } from "@/lib/supabase/dashboard-kpis";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { logAnalisisIaJoinStats } from "@/lib/supabase/analisis-ia";
import { fetchAnalisisIaForResenas } from "@/lib/supabase/analisis-ia.server";
import {
  compareReputationMetricResults,
  fetchSupabaseCanonicalReputationMetrics,
  mapSupabaseCanonicalMetrics,
  recordMetricValidationMismatch,
} from "@/lib/supabase/reputation-metrics.server";

export type LoadSnapshotOptions = {
  /** Omitir analisis_ia (más rápido en inicio del dashboard). */
  includeAnalisis?: boolean;
  /** No consultar dashboard_kpis (tabla opcional / a menudo ausente). */
  skipDashboardKpis?: boolean;
};

export type NexoPeriodSnapshot = {
  bounds: PeriodBounds;
  fetchedAt: Date;
  catalog: KpiRestaurantRow[];
  resenas: ResenaRow[];
  kpiDiario: KpiDiarioRow[];
  metrics: PeriodMetricsResult;
  activeKpiRows: KpiRestaurantRow[];
  dailySeries: DailyNetworkPoint[];
  chartPending: boolean;
  chartSource: "kpi_diario" | "resenas" | "empty";
  dashboardKpis: Awaited<ReturnType<typeof fetchDashboardKpisForPeriod>>;
  analisisByResenaId: AnalisisIaIndex;
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
 * Capa única de datos del periodo para todo el dashboard.
 * Agrupa siempre por restaurante_id.
 */
export async function loadNexoPeriodSnapshot(
  startKey: string,
  endKey: string,
  scope?: UserScope,
  options?: LoadSnapshotOptions
): Promise<NexoPeriodSnapshot> {
  const includeAnalisis = options?.includeAnalisis ?? true;
  const skipDashboardKpis = options?.skipDashboardKpis ?? false;
  const bounds = getPeriodBounds(startKey, endKey);
  const query = periodBoundsToQuery(bounds);

  const resenasPromise = safeFetch(
    "resenas",
    () =>
      fetchResenasForPeriodServer(
        { start: bounds.start, end: bounds.end },
        { queryBounds: query }
      ),
    [] as ResenaRow[]
  );
  const kpiDiarioPromise = safeFetch("kpi_diario", () => fetchKpiDiarioForPeriod(bounds), [] as KpiDiarioRow[]);
  const dashboardKpisPromise = skipDashboardKpis
    ? Promise.resolve(null)
    : safeFetch(
        "dashboard_kpis",
        () => fetchDashboardKpisForPeriod(bounds.startKey, bounds.endKey),
        null
      );

  const catalogRaw = await safeFetch("catalog", () => fetchAllKpiRowsCached(fetchAllKpiRows), [] as KpiRestaurantRow[]);
  const catalog = scope ? filterKpiRowsByScope(catalogRaw, scope) : catalogRaw;

  // El cálculo canónico en Supabase solo necesita el catálogo (ya disponible),
  // así que se lanza aquí — en paralelo con reseñas/kpi_diario/dashboard_kpis,
  // que suelen tardar más — en vez de esperar a que termine todo lo demás
  // primero. Si falla, null: más abajo se cae al cálculo legacy en vez de
  // tumbar el dashboard entero.
  const canonicalPromise = fetchSupabaseCanonicalReputationMetrics(
    bounds.startKey,
    bounds.endKey,
    catalog.map((row) => row.restaurante_id)
  ).catch((error) => {
    console.error(`[canonical-reputation] fetch failed for ${bounds.startKey}..${bounds.endKey}`, error);
    return null;
  });

  const [rawResenas, kpiDiarioRaw, dashboardKpis] = await Promise.all([
    resenasPromise,
    kpiDiarioPromise,
    dashboardKpisPromise,
  ]);

  const kpiDiario = scope ? filterKpiDiarioByScope(kpiDiarioRaw, scope) : kpiDiarioRaw;
  const resenas = dedupeResenas(
    scope ? filterResenasByScope(rawResenas, scope) : rawResenas
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

  // Cálculo legacy en TypeScript — se mantiene como red de seguridad (fallback
  // si Supabase falla) y como referencia para detectar desviaciones, nunca
  // como fuente servida por defecto.
  const legacyMetrics = buildPeriodMetrics({
    catalog,
    resenas,
    kpiDiario,
    analisisByResenaId,
  });

  const canonicalRows = await canonicalPromise;

  let metrics: PeriodMetricsResult;
  if (canonicalRows === null) {
    // La llamada a Supabase falló — se sirve el cálculo legacy en vez de
    // romper el dashboard entero por un fallo de red puntual.
    metrics = legacyMetrics;
  } else {
    metrics = mapSupabaseCanonicalMetrics({
      catalog,
      rows: canonicalRows,
      problemDistribution: legacyMetrics.problemDistribution,
    });

    const mismatches = compareReputationMetricResults(metrics, legacyMetrics);
    if (mismatches.length > 0) {
      console.error(
        `[canonical-reputation] Supabase/legacy mismatch for ${bounds.startKey}..${bounds.endKey}`,
        mismatches.slice(0, 20)
      );
      // No bloquea la respuesta al usuario por un insert de diagnóstico.
      recordMetricValidationMismatch({
        startKey: bounds.startKey,
        endKey: bounds.endKey,
        restaurantCount: catalog.length,
        mismatches,
      }).catch((error) => console.error("[recordMetricValidationMismatch]", error));
    }
  }

  const activeKpiRows = catalog.map((row) => {
    const period = metrics.byRestaurante.get(row.restaurante_id);
    return period ? metricsToKpiRow(row, period) : { ...row, total_resenas: 0, resenas_negativas: 0, resenas_positivas: 0 };
  });

  const { series: dailySeries, source: chartSource } = resolveDailyNetworkSeries(kpiDiario, resenas);

  return {
    bounds,
    fetchedAt: new Date(),
    catalog,
    resenas,
    kpiDiario,
    metrics,
    activeKpiRows,
    dailySeries,
    chartPending: dailySeries.length === 0,
    chartSource,
    dashboardKpis,
    analisisByResenaId,
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

export function mergeNetworkWithDashboardKpis(
  network: NetworkPeriodMetrics,
  dashboardKpis: NexoPeriodSnapshot["dashboardKpis"]
): NetworkPeriodMetrics {
  if (!dashboardKpis) return network;
  return {
    ...network,
    mediaGlobal: dashboardKpis.mediaGlobal || network.mediaGlobal,
    totalResenas: dashboardKpis.totalResenas || network.totalResenas,
    totalNegativas: dashboardKpis.totalNegativas || network.totalNegativas,
    totalPositivas: dashboardKpis.totalPositivas || network.totalPositivas,
    totalRestaurantes: dashboardKpis.totalRestaurantes || network.totalRestaurantes,
    positivePct:
      (dashboardKpis.totalResenas || network.totalResenas) > 0
        ? Math.round(
            ((dashboardKpis.totalPositivas || network.totalPositivas) /
              (dashboardKpis.totalResenas || network.totalResenas)) *
              1000
          ) / 10
        : network.positivePct,
    negativePct:
      (dashboardKpis.totalResenas || network.totalResenas) > 0
        ? Math.round(
            ((dashboardKpis.totalNegativas || network.totalNegativas) /
              (dashboardKpis.totalResenas || network.totalResenas)) *
              1000
          ) / 10
        : network.negativePct,
  };
}
