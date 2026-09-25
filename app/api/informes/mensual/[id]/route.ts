import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadMonthlyReport } from "@/lib/reports/monthly/data";
import { generateMonthlyPdf } from "@/lib/reports/monthly/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const restaurantId = Number(id);
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1 || !Number.isInteger(offset) || offset < 0 || offset > 35) {
    return NextResponse.json({ error: "Restaurante o mes no válido" }, { status: 400 });
  }
  try {
    const report = await loadMonthlyReport(restaurantId, offset, auth.session.scope);
    if (!report) return NextResponse.json({ error: "Restaurante no disponible" }, { status: 404 });
    const pdf = await generateMonthlyPdf(report);
    const slug = report.restaurant.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `Nexo_Origen_${slug}_${report.startKey.slice(0, 7)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[api/informes/mensual/id]", error);
    return NextResponse.json({ error: error instanceof Error && error.message.includes("no coinciden")
      ? "Los datos del registro no coinciden con las métricas del mes. Revisa la carga de reseñas."
      : "No se pudo generar el informe mensual" }, { status: 500 });
  }
}
