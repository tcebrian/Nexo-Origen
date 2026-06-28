import { toDateKey } from "@/lib/dates/period";
import {
  loadNexoPeriodSnapshot,
  mergeNetworkWithDashboardKpis,
  type LoadSnapshotOptions,
} from "@/lib/dashboard-data";
import type { UserScope } from "@/lib/auth/types";
import type {
  PeriodData,
  PeriodDataSource,
} from "./period-types";

export type {
  PeriodAggregates,
  PeriodData,
  PeriodDataSource,
  RestaurantPeriodMetrics,
} from "./period-types";

export async function getPeriodData(
  startKey: string,
  endKey: string,
  scope?: UserScope,
  options?: LoadSnapshotOptions
): Promise<PeriodData> {
  const snapshot = await loadNexoPeriodSnapshot(startKey, endKey, scope, options);
  const network = mergeNetworkWithDashboardKpis(
    snapshot.metrics.network,
    snapshot.dashboardKpis
  );

  const source: PeriodDataSource =
    network.source === "resenas"
      ? "resenas"
      : network.source === "kpi_diario"
        ? "kpi_diario"
        : "kpi_restaurantes";

  return {
    bounds: snapshot.bounds,
    catalog: snapshot.catalog,
    activeKpiRows: snapshot.activeKpiRows,
    aggregates: {
      totalResenas: network.totalResenas,
      totalNegativas: network.totalNegativas,
      totalPositivas: network.totalPositivas,
      mediaGlobal: network.mediaGlobal,
      byRestaurante: snapshot.metrics.byRestaurante,
      hasResenasEnPeriodo: snapshot.resenas.length > 0,
      source,
      ultimaActualizacion: network.ultimaActualizacion,
      positivePct: network.positivePct,
      negativePct: network.negativePct,
    },
    dailySeries: snapshot.dailySeries,
    kpiDiarioRows: snapshot.kpiDiario,
    resenas: snapshot.resenas,
    fetchedAt: snapshot.fetchedAt,
    problemDistribution: snapshot.metrics.problemDistribution,
    chartSource: snapshot.chartSource,
    analisisByResenaId: snapshot.analisisByResenaId,
    dashboardKpis: snapshot.dashboardKpis,
  };
}

export { toDateKey };
