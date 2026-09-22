import { buildAutomationsPlaceholder, buildReportsFromKpi } from "@/lib/supabase/reports-builder";
import { loadPeriodData } from "@/lib/supabase/period-api";
import type { ReportRecord } from "./types";
import type { PeriodData, PeriodNetworkAggregate } from "@/lib/supabase/period-types";
import type { ReportsRepository } from "./repository";


function networkAggregate(period: PeriodData): PeriodNetworkAggregate {
  return {
    totalResenas: period.aggregates.totalResenas,
    totalPositivas: period.aggregates.totalPositivas,
    totalNegativas: period.aggregates.totalNegativas,
    totalNeutras: period.aggregates.totalNeutras,
    totalAtencion: period.aggregates.totalAtencion,
    mediaGlobal: period.aggregates.mediaGlobal,
    positivePct: period.aggregates.positivePct,
    negativePct: period.aggregates.negativePct,
    totalRestaurantes: period.activeKpiRows.length,
    ultimaActualizacion: period.aggregates.ultimaActualizacion,
  };
}

const EMPTY_REPORT: ReportRecord = {
  id: "report-empty",
  title: "Sin informes para el periodo",
  type: "semanal",
  librarySection: "semanal",
  company: "Grupo Hambar",
  brand: "todas",
  brandLabel: "Grupo Hámbar",
  periodLabel: "Periodo sin datos",
  date: new Date(),
  restaurantsAnalyzed: 0,
  status: "stable",
  summary: { onTarget: 0, onWatch: 0, atRisk: 0 },
  express: {
    bestRestaurant: "Sin datos",
    bestImprovement: "Sin datos",
    highestRisk: "Sin datos",
    preventProtection: 0,
  },
};

export const supabaseReportsRepository: ReportsRepository = {
  async getLatest(query) {
    try {
      const period = await loadPeriodData(query.start, query.end);
      const reports = buildReportsFromKpi(
        period.activeKpiRows,
        { start: period.bounds.start, end: period.bounds.end },
        {
          network: networkAggregate(period),
          byBrand: period.aggregates.byBrand,
          problemDistribution: period.problemDistribution,
          problemDistributionByBrand: period.problemDistributionByBrand,
        }
      );
      return reports[0] ?? { ...EMPTY_REPORT, date: query.end };
    } catch (error) {
      console.error("[supabaseReportsRepository.getLatest]", error);
      return { ...EMPTY_REPORT, date: query.end };
    }
  },

  async listLibrary(query) {
    try {
      const period = await loadPeriodData(query.start, query.end);
      return buildReportsFromKpi(
        period.activeKpiRows,
        { start: period.bounds.start, end: period.bounds.end },
        {
          network: networkAggregate(period),
          byBrand: period.aggregates.byBrand,
          problemDistribution: period.problemDistribution,
          problemDistributionByBrand: period.problemDistributionByBrand,
        }
      );
    } catch (error) {
      console.error("[supabaseReportsRepository.listLibrary]", error);
      return [];
    }
  },

  async listAutomations() {
    return buildAutomationsPlaceholder();
  },
};
