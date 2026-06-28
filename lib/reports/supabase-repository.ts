import { buildAutomationsPlaceholder, buildReportsFromKpi } from "@/lib/supabase/reports-builder";
import { loadPeriodData } from "@/lib/supabase/period-api";
import { fetchResenasForPeriod } from "@/lib/supabase/resenas";
import type { ReportRecord } from "./types";
import type { ReportsRepository } from "./repository";

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
      const { activeKpiRows: rows, bounds, analisisByResenaId } = await loadPeriodData(query.start, query.end);
      const resenas = await fetchResenasForPeriod({ start: bounds.start, end: bounds.end });
      const reports = buildReportsFromKpi(
        rows,
        { start: bounds.start, end: bounds.end },
        resenas,
        analisisByResenaId
      );
      return reports[0] ?? { ...EMPTY_REPORT, date: query.end };
    } catch (error) {
      console.error("[supabaseReportsRepository.getLatest]", error);
      return { ...EMPTY_REPORT, date: query.end };
    }
  },

  async listLibrary(query) {
    try {
      const { activeKpiRows: rows, bounds, analisisByResenaId } = await loadPeriodData(query.start, query.end);
      const resenas = await fetchResenasForPeriod({ start: bounds.start, end: bounds.end });
      return buildReportsFromKpi(
        rows,
        { start: bounds.start, end: bounds.end },
        resenas,
        analisisByResenaId
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
