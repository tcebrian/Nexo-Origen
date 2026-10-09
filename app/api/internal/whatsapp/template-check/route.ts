import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { CHECKABLE_TEMPLATES, checkTemplate, isCheckableTemplate } from "@/lib/whatsapp/template-check.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DIAGNÓSTICO TEMPORAL, solo super_admin y solo lectura:
 *   GET /api/internal/whatsapp/template-check?name=bienvenido_nexo
 * Devuelve cómo tiene Meta registrada la plantilla (name, language, status, category, id) para comprobar
 * su idioma REAL. El WABA está fijado en el servidor, solo se admiten los nombres de la lista y no se
 * modifica nada. Nunca devuelve ni registra el token. Se retirará cuando termine el diagnóstico.
 */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const name = params.get("name");
  // Solo `name`: cualquier otro parámetro (p. ej. un WABA) se rechaza, no se ignora.
  const extra = [...params.keys()].filter((key) => key !== "name");
  if (!isCheckableTemplate(name) || extra.length > 0) {
    return NextResponse.json({ error: "Plantilla no permitida", allowed: CHECKABLE_TEMPLATES }, { status: 400 });
  }

  const result = await checkTemplate(name);
  const headers = { "Cache-Control": "private, no-store" };

  if (!result.ok) {
    if (result.reason === "misconfigured") {
      return NextResponse.json({ error: "WHATSAPP_CLOUD_ACCESS_TOKEN no está configurado" }, { status: 500, headers });
    }
    if (result.reason === "unreachable") {
      return NextResponse.json({ error: "No se pudo contactar con Meta" }, { status: 502, headers });
    }
    const { code, subcode, type, httpStatus, message, details } = result.error;
    console.error(`[whatsapp] template_check_failed name=${name} metaCode=${code ?? "-"} metaSubcode=${subcode ?? "-"} http=${httpStatus}`);
    return NextResponse.json(
      { error: "Meta rechazó la consulta", meta: { code, subcode, type, httpStatus, message, details } },
      { status: 502, headers }
    );
  }

  if (result.templates.length === 0) {
    return NextResponse.json({ name, found: false, templates: [] }, { status: 404, headers });
  }
  // Una sola traducción → respuesta plana; varias → la lista completa de idiomas.
  if (result.templates.length === 1) {
    const [{ language, status, category, id }] = result.templates;
    return NextResponse.json({ name, language, status, category, id }, { headers });
  }
  return NextResponse.json({ name, translations: result.templates }, { headers });
}
