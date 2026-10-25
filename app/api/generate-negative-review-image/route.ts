import { requireApiAuth } from "@/lib/auth/api-auth";
import { readJsonBody } from "@/lib/http/read-json-body";
import { RenderError, renderViaInternal } from "@/lib/render/internal-render-client";
import { consumeRateLimit } from "@/lib/security/rate-limit.server";
import { validateAlertPayload } from "@/lib/templates/negative-review-alert/validate-payload";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El arranque en frío de Chromium (extraer y lanzar el binario de
// @sparticuz/chromium) puede tardar bastante más que el timeout por
// defecto de una función de Vercel.
export const maxDuration = 60;

/** Tope del cuerpo: una alerta real pesa pocos KB (la reseña de Google admite 4096 caracteres). */
const MAX_BODY_BYTES = 64 * 1024;
/** Generaciones por usuario autenticado y minuto (cada una arranca Chromium). */
const RATE_LIMIT = { limit: 10, windowSeconds: 60 } as const;

const GENERIC_ERROR = "No se pudo generar la imagen de alerta.";
const json = (status: number, error: string, headers?: Record<string, string>) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

function buildFilename(data: NegativeReviewAlertData): string {
  const slug = data.restaurant_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = data.review_date
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "");
  return `nexo-alerta-${slug || "restaurante"}-${date || "fecha"}.png`;
}

/**
 * Genera el PNG de la alerta a partir de los datos que envía la propia pantalla (modal de reseñas y /preview).
 * No lee datos de Supabase: renderiza lo recibido, así que no hay fuga entre empresas; lo que se protege aquí es el
 * coste (Chromium). Orden deliberado, cada paso antes del siguiente más caro:
 *   1. sesión (401)  2. límite por usuario (429)  3. tamaño real del cuerpo (413/400)  4. payload estricto (400)
 *   5. renderer interno (HMAC + guard de red).
 * Cualquier usuario autenticado con un perfil válido puede usarla (el modal de reseñas es de todos los roles).
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  // Clave del límite = usuario autenticado en el servidor, nunca un dato del cliente.
  const limit = await consumeRateLimit(`negative-review-image:${auth.session.userId}`, RATE_LIMIT);
  if (!limit.allowed) {
    return json(429, "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return json(body.status, body.status === 413 ? "La petición es demasiado grande." : "Petición no válida.");
  }

  const payload = validateAlertPayload(body.value);
  if (!payload.ok) return json(400, `Datos de la alerta no válidos (${payload.field}).`);

  try {
    const png = await renderViaInternal({ op: "negative_review_image", data: payload.data });

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${buildFilename(payload.data)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Solo el tipo (y el estado del renderer): el mensaje puede traer rutas, Chromium o datos de la alerta.
    const type = error instanceof Error ? error.name : "UnknownError";
    const status = error instanceof RenderError ? ` status=${error.status}` : "";
    console.error(`[api/generate-negative-review-image] render failed type=${type}${status}`);
    return json(500, GENERIC_ERROR);
  }
}
