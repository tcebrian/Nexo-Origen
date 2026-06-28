import { NextResponse } from "next/server";
import { findReportById } from "@/lib/reports/find-report";
import { buildPdfResponse } from "@/lib/reports/pdf-response";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const report = await findReportById(decodeURIComponent(id));

    if (!report) {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }

    return buildPdfResponse(report);
  } catch {
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500 });
  }
}
