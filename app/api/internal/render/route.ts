import {
  RENDER_MAX_BODY_BYTES,
  RENDER_SIGNATURE_HEADER,
  RENDER_TIMESTAMP_HEADER,
  parseRenderRequest,
  renderSecret,
  verifyRenderSignature,
} from "@/lib/render/protocol";
import { executeRender } from "@/lib/render/renderer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Un render por llamada: Chromium en frío + captura + sharp. Las rutas públicas esperan como máximo 55 s.
export const maxDuration = 60;

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Renderer interno: la ÚNICA función que empaqueta Chromium, sharp y los assets de las plantillas.
 * Lo llaman las rutas públicas de informes/alertas/Conversations desde el servidor, después de
 * resolver auth, scope y datos; este endpoint NO decide permisos de usuario.
 *
 *  - Sin sesión de usuario (prefijo público en `route-guard.ts`): se autentica con la firma HMAC de
 *    `NEXO_INTERNAL_RENDER_TOKEN` sobre el cuerpo + marca de tiempo (ventana de 60 s).
 *  - Operaciones cerradas con parámetros validados; no acepta URLs, hosts ni orígenes.
 *  - Responde solo bytes (PNG o PDF) o un error en JSON.
 */
export async function POST(request: Request) {
  const secret = renderSecret();
  if (!secret) return json(503, { error: "Renderer no configurado" });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > RENDER_MAX_BODY_BYTES) return json(413, { error: "Petición demasiado grande" });

  const rawBody = new Uint8Array(await request.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (rawBody.length > RENDER_MAX_BODY_BYTES) return json(413, { error: "Petición demasiado grande" });

  // Misma respuesta para cualquier fallo de autenticación: no se revela cuál fue.
  const check = verifyRenderSignature({
    rawBody,
    timestamp: request.headers.get(RENDER_TIMESTAMP_HEADER),
    signature: request.headers.get(RENDER_SIGNATURE_HEADER),
    secret,
    nowMs: Date.now(),
  });
  if (!check.ok) return json(401, { error: "No autorizado" });

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return json(400, { error: "Petición no válida" });
  }

  const parsed = parseRenderRequest(body);
  if (!parsed.ok) return json(400, { error: parsed.error });

  try {
    const { contentType, body: bytes } = await executeRender(parsed.request);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    console.error(`[api/internal/render] ${parsed.request.op}`, error);
    return json(500, { error: error instanceof Error ? error.message : "No se pudo generar el archivo" });
  }
}
