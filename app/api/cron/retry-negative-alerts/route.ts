import { createHash, timingSafeEqual } from "node:crypto";
import { retryNegativeAlertImages } from "@/lib/alerts/negative-review/process.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Comparación en tiempo constante, sin filtrar la longitud del secreto. */
function sameSecret(provided: string, expected: string): boolean {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Sin secreto configurado el job está cerrado: envía WhatsApps reales.
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && sameSecret(header.slice("Bearer ".length), secret);
}

/**
 * Reintenta una vez (a los ~5 min) las alertas negativas cuya imagen falló con la ventana de WhatsApp abierta y,
 * si vuelve a fallar, deja un aviso al contacto. Lo dispara pg_cron cada pocos minutos; es idempotente: una
 * alerta ya reintentada queda marcada y no se vuelve a recoger. No es una ruta de usuario.
 */
async function run(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  try {
    const result = await retryNegativeAlertImages();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron/retry-negative-alerts]", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, error: "No se pudo reintentar las alertas." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
