import type { ReportRecord } from "./types";
import { resolveWeeklyReportData } from "./weekly/resolve";

function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getReportPdfFilename(report: ReportRecord) {
  const weekly = resolveWeeklyReportData(report);
  const brandSlug = weekly
    ? slugifyFilename(weekly.theme.brandTitle)
    : slugifyFilename(report.brandLabel || report.company);
  const base = `informe-semanal-${brandSlug}-${slugifyFilename(report.periodLabel)}`;
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}
