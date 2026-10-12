import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processNegativeAlert } from "@/lib/alerts/negative-review/process.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generar la imagen (Chromium) y enviar a varios contactos puede tardar.
export const maxDuration = 60;

/**
 * Alerta de reseña negativa por WhatsApp (Conversations). La llama un Database Webhook de Supabase al
 * insertar en `resenas` (`x-webhook-secret` = WHATSAPP_WEBHOOK_SECRET, el mismo secreto de los avisos
 * existentes). Acepta el cuerpo de Supabase `{ type, record: { id } }` o `{ resena_id }`.
 *
 * Solo se usa el id: estrellas, restaurante y destinatarios se leen de la base de datos (nunca del cuerpo).
 * Los destinatarios salen de los permisos de contacto (deny by default). Idempotente por (reseña, contacto).
 * La respuesta solo lleva contadores: nunca teléfonos, nombres ni contenido.
 */
function secretMatches(received: string | null, expected: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-webhook-secret"), process.env.WHATSAPP_WEBHOOK_SECRET)) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    record?: { id?: unknown } | null;
    resena_id?: unknown;
  } | null;

  if (body?.type !== undefined && body.type !== "INSERT") {
    return NextResponse.json({ ok: true, skipped: "no-insert" });
  }

  const rawId = body?.record?.id ?? body?.resena_id;
  const resenaId = typeof rawId === "number" ? rawId : typeof rawId === "string" && /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(resenaId) || resenaId <= 0) {
    return NextResponse.json({ ok: true, skipped: "payload-incompleto" });
  }

  try {
    const result = await processNegativeAlert(resenaId);
    if (result.status === "skipped") return NextResponse.json({ ok: true, skipped: result.reason });

    const summary: Record<string, number> = {};
    for (const { outcome } of result.outcomes) summary[outcome] = (summary[outcome] ?? 0) + 1;
    return NextResponse.json({ ok: true, recipients: result.recipients, outcomes: summary });
  } catch (error) {
    // Solo el tipo de error. Supabase reintentará: las alertas ya reservadas no se duplican.
    console.error("[negative-alert] webhook failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "No se pudo procesar la alerta" }, { status: 500 });
  }
}
