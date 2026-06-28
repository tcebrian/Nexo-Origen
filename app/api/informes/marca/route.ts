import { fetchInformeMarcaDatos } from "@/lib/informes/fetch-informe-marca-datos";
import { generatePdfFromHtml } from "@/lib/informes/generate-pdf-from-html";
import {
  buildLeftColOnlyHtml,
  buildCoverCompositeHtmlForPdf,
  buildSummaryOnlyHtml,
} from "@/lib/informes/marca-report-html";
import { isValidDateKey } from "@/lib/dates/period";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPdfFilename(marca: string): string {
  const slug = marca
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `nexo-informe-marca-${slug || "marca"}.pdf`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand")?.trim();
    const startKey = searchParams.get("start") ?? undefined;
    const endKey = searchParams.get("end") ?? undefined;

    if (!brand) {
      return NextResponse.json(
        { error: "Parámetro brand requerido. Ejemplo: ?brand=Burger%20King" },
        { status: 400 }
      );
    }

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

    const datos = await fetchInformeMarcaDatos(brand, startKey, endKey);
    const filename = buildPdfFilename(datos.marca);
    const pdf = await generatePdfFromHtml({
      leftColHtml: buildLeftColOnlyHtml(datos),
      buildCoverComposite: (leftColB64) =>
        buildCoverCompositeHtmlForPdf(leftColB64, datos),
      summaryHtml: buildSummaryOnlyHtml(datos),
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/informes/marca]", error);
    return NextResponse.json(
      {
        error: "No se pudo generar el informe por marca",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
