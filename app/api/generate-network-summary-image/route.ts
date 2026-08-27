import { requireApiAuth } from "@/lib/auth/api-auth";
import { isReportPeriodSlug, REPORT_PERIOD_LABELS } from "@/lib/reports/period-ranges";
import { isNetworkReportGroupId, NETWORK_REPORT_GROUPS } from "@/lib/reports/network-summary/brand-groups";
import { captureNetworkSummaryPng } from "@/lib/reports/network-summary/capture-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams, origin } = new URL(request.url);
  const periodo = searchParams.get("periodo") ?? "";
  const grupo = searchParams.get("grupo") ?? "";
  const offsetParam = searchParams.get("offset");
  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

  if (!isReportPeriodSlug(periodo)) {
    return Response.json({ error: "Parámetro periodo inválido" }, { status: 400 });
  }
  if (!isNetworkReportGroupId(grupo)) {
    return Response.json({ error: "Parámetro grupo inválido" }, { status: 400 });
  }

  try {
    const png = await captureNetworkSummaryPng(periodo, grupo, origin, Number.isFinite(offset) ? offset : 0);
    const group = NETWORK_REPORT_GROUPS[grupo];
    const slug = group.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="nexo-informe-${periodo}-${slug}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/generate-network-summary-image]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : `No se pudo generar el informe ${REPORT_PERIOD_LABELS[periodo]}.`,
      },
      { status: 500 }
    );
  }
}
