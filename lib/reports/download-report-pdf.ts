import { canDownloadReportById } from "./find-report";
import type { ReportRecord } from "./types";

function normalizeReport(report: ReportRecord): ReportRecord {
  return {
    ...report,
    date: report.date instanceof Date ? report.date : new Date(report.date),
  };
}

function serializeReport(report: ReportRecord) {
  const normalized = normalizeReport(report);
  return {
    ...normalized,
    date: normalized.date.toISOString(),
  };
}

function downloadViaHiddenForm(report: ReportRecord) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/reports/pdf";
  form.style.display = "none";
  form.acceptCharset = "UTF-8";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "report";
  input.value = JSON.stringify(serializeReport(report));
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function downloadViaNavigation(reportId: string) {
  const link = document.createElement("a");
  link.href = `/api/reports/pdf/${encodeURIComponent(reportId)}`;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadReportPdf(report: ReportRecord) {
  const normalized = normalizeReport(report);

  if (normalized.weeklyData) {
    downloadViaHiddenForm(normalized);
    return;
  }

  if (await canDownloadReportById(normalized.id)) {
    downloadViaNavigation(normalized.id);
    return;
  }

  downloadViaHiddenForm(normalized);
}
