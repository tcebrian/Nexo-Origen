import type { PeriodBounds } from "@/lib/dates/period";
import type { ProblemDistributionItem, RestaurantPeriodMetrics } from "@/lib/review-metrics";
import type { AnalisisIaIndex } from "./analisis-ia";
import type { DashboardKpisSnapshot } from "./dashboard-kpis";
import type { DailyNetworkPoint, KpiDiarioRow } from "./kpi-diario";
import type { KpiRestaurantRow } from "./kpi-restaurantes";
import type { ResenaRow } from "./resenas";

export type { RestaurantPeriodMetrics };

export type PeriodDataSource = "kpi_diario" | "resenas" | "kpi_restaurantes";

export type PeriodAggregates = {
  totalResenas: number;
  totalNegativas: number;
  totalPositivas: number;
  mediaGlobal: number;
  byRestaurante: Map<number, RestaurantPeriodMetrics>;
  hasResenasEnPeriodo: boolean;
  source: PeriodDataSource;
  ultimaActualizacion: string | null;
  positivePct: number;
  negativePct: number;
};

export type PeriodData = {
  bounds: PeriodBounds;
  catalog: KpiRestaurantRow[];
  activeKpiRows: KpiRestaurantRow[];
  aggregates: PeriodAggregates;
  dailySeries: DailyNetworkPoint[];
  kpiDiarioRows: KpiDiarioRow[];
  resenas: ResenaRow[];
  fetchedAt: Date;
  problemDistribution: ProblemDistributionItem[];
  chartSource: "kpi_diario" | "resenas" | "empty";
  analisisByResenaId: AnalisisIaIndex;
  dashboardKpis: DashboardKpisSnapshot | null;
};
