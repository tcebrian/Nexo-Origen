import { NextResponse } from "next/server";
import { reportPdfToArrayBuffer } from "./create-report-pdf";
import { getReportPdfFilename } from "./report-pdf-filename";
import type { ReportRecord } from "./types";

function normalizeReport(report: ReportRecord): ReportRecord {
  return {
    ...report,
    date: report.date instanceof Date ? report.date : new Date(report.date),
  };
}

function asciiFilename(filename: string) {
  return filename.replace(/[^\x20-\x7E]/g, "_");
}

export async function buildPdfResponse(report: ReportRecord) {
  const normalized = normalizeReport(report);
  const buffer = await reportPdfToArrayBuffer(normalized);
  const filename = getReportPdfFilename(normalized);
  const asciiName = asciiFilename(filename);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
