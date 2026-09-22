import { buildReportsFromKpi } from "@/lib/supabase/reports-builder";
import { loadPeriodData } from "@/lib/supabase/period-api";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { PeriodData, PeriodNetworkAggregate } from "@/lib/supabase/period-types";
import type { ReportRecord } from "./types";

function parseReportId(id: string): { brand: BrandId | "todas"; endKey: string } | null {
  if (id.startsWith("report-network-")) {
    return { brand: "todas", endKey: id.replace("report-network-", "") };
  }

  const match = id.match(/^report-(\w+)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;

  return { brand: match[1] as BrandId, endKey: match[2] };
}

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

export async function findReportById(id: string): Promise<ReportRecord | undefined> {
  const parsed = parseReportId(id);
  if (!parsed) return undefined;

  const end = new Date(`${parsed.endKey}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const period = await loadPeriodData(start, end);
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

  return reports.find((report) => report.id === id);
}

export async function canDownloadReportById(id: string) {
  const report = await findReportById(id);
  return Boolean(report);
}
