import { NextResponse } from "next/server";
import { findReportById } from "@/lib/reports/find-report";
import { buildPdfResponse } from "@/lib/reports/pdf-response";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { rateLimitAuthenticatedUser } from "@/lib/security/rate-limit.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimitAuthenticatedUser("report-pdf", auth.session.userId);
  if (limited) return limited;

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
