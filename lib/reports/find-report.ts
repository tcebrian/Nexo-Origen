import { buildReportsFromKpi } from "@/lib/supabase/reports-builder";
import { loadPeriodData } from "@/lib/supabase/period-api";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { ReportRecord } from "./types";

function parseReportId(id: string): { brand: BrandId | "todas"; endKey: string } | null {
  if (id.startsWith("report-network-")) {
    return { brand: "todas", endKey: id.replace("report-network-", "") };
  }

  const match = id.match(/^report-(\w+)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;

  return { brand: match[1] as BrandId, endKey: match[2] };
}

export async function findReportById(id: string): Promise<ReportRecord | undefined> {
  const parsed = parseReportId(id);
  if (!parsed) return undefined;

  const end = new Date(`${parsed.endKey}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const { activeKpiRows, bounds, analisisByResenaId } = await loadPeriodData(start, end);
  const resenas = await fetchResenasForPeriodServer({ start: bounds.start, end: bounds.end });
  const reports = buildReportsFromKpi(
    activeKpiRows,
    { start: bounds.start, end: bounds.end },
    resenas,
    analisisByResenaId
  );

  return reports.find((report) => report.id === id);
}

export async function canDownloadReportById(id: string) {
  const report = await findReportById(id);
  return Boolean(report);
}
