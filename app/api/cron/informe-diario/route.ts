import { createHash, timingSafeEqual } from "node:crypto";
import { processDailyReport } from "@/lib/reports/daily/process.server";

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
  // Sin secreto configurado el job está cerrado (no hay respaldo por user-agent: envía WhatsApps reales).
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && sameSecret(header.slice("Bearer ".length), secret);
}

/**
 * Informe diario de las 09:00 (Europe/Madrid). Lo dispara el cron de Supabase (pg_cron + pg_net) varias
 * veces entre las 07:00 y las 08:59 UTC; solo actúa cuando en Madrid son las 09:00–11:59 y es idempotente
 * por (contacto, día, plantilla), así que repetirlo no duplica nada. No es una ruta de usuario.
 */
async function run(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  try {
    const result = await processDailyReport();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron/informe-diario]", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, error: "No se pudo procesar el informe diario." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
