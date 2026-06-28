import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { ReportRecord } from "../types";
import { buildWeeklyReportFromKpi } from "./build-from-kpi";
import type { WeeklyReportData, WeeklyTemplateId } from "./types";

function inferTemplateFromBrand(brand: ReportRecord["brand"]): WeeklyTemplateId {
  if (brand === "bk") return "bk";
  if (brand === "sg") return "sg";
  if (brand === "th") return "tim-hortons";
  if (brand === "ribs" || brand === "tv" || brand === "sibuya") return "grupo-hambar";
  return "grupo-hambar";
}

export function resolveWeeklyTemplateId(report: ReportRecord): WeeklyTemplateId | null {
  if (report.type !== "semanal") return null;
  if (report.weeklyTemplateId) return report.weeklyTemplateId;
  if (report.brand !== "todas") return inferTemplateFromBrand(report.brand);
  return "grupo-hambar";
}

export function resolveWeeklyReportData(report: ReportRecord): WeeklyReportData | null {
  if (report.type !== "semanal") return null;
  if (report.weeklyData) return report.weeklyData;

  const templateId = resolveWeeklyTemplateId(report);
  if (!templateId) return null;

  const end = report.date instanceof Date ? report.date : new Date(report.date);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return buildWeeklyReportFromKpi([], templateId, { start, end });
}

export function isWeeklyReport(report: ReportRecord) {
  return report.type === "semanal";
}

export function weeklyTemplateForBrand(brand: BrandId | "todas"): WeeklyTemplateId {
  return inferTemplateFromBrand(brand);
}
