import { fetchInformeKpiDatos } from "@/lib/informes/fetch-informe-kpi-datos";
import { generatePdfFromHtml } from "@/lib/informes/generate-pdf-from-html";
import { buildTestReportHtml } from "@/lib/informes/test-report-html";
import { isValidDateKey } from "@/lib/dates/period";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_FILENAME = "nexo-informe-prueba.pdf";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startKey = searchParams.get("start") ?? undefined;
    const endKey = searchParams.get("end") ?? undefined;

    if ((startKey && !endKey) || (!startKey && endKey)) {
      return NextResponse.json(
        { error: "Indica start y end juntos (YYYY-MM-DD) o ninguno." },
        { status: 400 }
      );
    }

    if (startKey && endKey && (!isValidDateKey(startKey) || !isValidDateKey(endKey))) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const datos = await fetchInformeKpiDatos(startKey, endKey);
    const html = buildTestReportHtml(datos);
    const pdf = await generatePdfFromHtml({
      leftColHtml: html,
      summaryHtml: "<!DOCTYPE html><html><body></body></html>",
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${PDF_FILENAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/informes/test]", error);
    return NextResponse.json(
      {
        error: "No se pudo generar el PDF de prueba",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
