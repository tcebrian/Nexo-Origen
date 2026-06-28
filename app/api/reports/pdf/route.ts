import { NextResponse } from "next/server";
import { buildPdfResponse } from "@/lib/reports/pdf-response";
import type { ReportRecord } from "@/lib/reports/types";

export const runtime = "nodejs";

function parseReportFromFormBody(body: string): ReportRecord {
  const params = new URLSearchParams(body);
  const raw = params.get("report");
  if (!raw) {
    throw new Error("Falta el campo report");
  }
  return JSON.parse(raw) as ReportRecord;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let report: ReportRecord;

    if (contentType.includes("application/json")) {
      report = (await request.json()) as ReportRecord;
    } else {
      const body = await request.text();
      report = parseReportFromFormBody(body);
    }

    return buildPdfResponse(report);
  } catch {
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500 });
  }
}
