import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { isReportPeriodSlug, REPORT_PERIOD_LABELS } from "@/lib/reports/period-ranges";
import { isNetworkReportGroupId, NETWORK_REPORT_GROUPS } from "@/lib/reports/network-summary/brand-groups";
import { renderViaInternal } from "@/lib/render/internal-render-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  // SEC-002: el resumen de red agrega TODOS los locales del grupo (sin scope de usuario), así que es solo
  // super_admin. Se comprueba aquí aunque el middleware y `requireApiAuth` ya lo exijan (defensa en
  // profundidad) y ANTES de leer `grupo`: ningún parámetro del cliente decide qué datos se cargan.
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
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
    const png = await renderViaInternal({
      op: "network_summary_image",
      periodo,
      grupo,
      offset: Number.isFinite(offset) ? offset : 0,
    });
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
