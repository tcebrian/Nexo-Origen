import type { PeriodBounds } from "@/lib/dates/period";
import type { ProblemDistributionItem, RestaurantPeriodMetrics } from "@/lib/review-metrics";
import type { AnalisisIaIndex } from "./analisis-ia";
import type { DashboardKpisSnapshot } from "./dashboard-kpis";
import type { DailyNetworkPoint, KpiDiarioRow } from "./kpi-diario";
import type { KpiRestaurantRow } from "./kpi-restaurantes";
import type { ResenaRow } from "./resenas";
import type { MediaImpactResult } from "@/lib/reviews/media-impact";

export type { RestaurantPeriodMetrics };

export type PeriodDataSource = "resenas" | "empty";

export type PeriodNetworkAggregate = {
  totalResenas: number;
  totalPositivas: number;
  totalNegativas: number;
  totalNeutras: number;
  totalAtencion: number;
  mediaGlobal: number;
  positivePct: number;
  negativePct: number;
  totalRestaurantes: number;
  ultimaActualizacion: string | null;
};

export type PeriodAggregates = {
  totalResenas: number;
  totalNegativas: number;
  totalPositivas: number;
  totalNeutras: number;
  totalAtencion: number;
  mediaGlobal: number;
  byRestaurante: Map<number, RestaurantPeriodMetrics>;
  hasResenasEnPeriodo: boolean;
  source: PeriodDataSource;
  ultimaActualizacion: string | null;
  positivePct: number;
  negativePct: number;
  byBrand: Record<string, PeriodNetworkAggregate>;
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
  problemDistributionByBrand: Record<string, ProblemDistributionItem[]>;
  chartSource: "kpi_diario" | "resenas" | "empty";
  analisisByResenaId: AnalisisIaIndex;
  impactByResenaId: Map<number, MediaImpactResult>;
  dashboardKpis: DashboardKpisSnapshot | null;
};
