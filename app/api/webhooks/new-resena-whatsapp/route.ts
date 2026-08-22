import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendWhatsAppImageAlert } from "@/lib/notifications/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Empresas cuyas reseñas negativas se avisan por WhatsApp, y a quién. */
const EMPRESA_RECIPIENTS: Record<number, string[]> = {
  // Grupo Hámbar
  1: ["+34688718820"],
};

type SupabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: number;
    restaurante_id: number | null;
    estrellas: number | null;
    review_id: string | number | null;
  } | null;
};

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const incomingSecret = request.headers.get("x-webhook-secret");
  if (!secret || incomingSecret !== secret) {
    return new Response("No autorizado", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as SupabaseWebhookPayload | null;
  const record = payload?.record;

  if (!record || record.restaurante_id == null || record.estrellas == null) {
    return Response.json({ ok: true, skipped: "payload-incompleto" });
  }

  // Solo reseñas negativas (mismo criterio que el resto de la app: <= 3 estrellas).
  if (record.estrellas > 3) {
    return Response.json({ ok: true, skipped: "no-negativa" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ ok: false, error: "Supabase admin no configurado" }, { status: 500 });
  }

  const { data: restaurante } = await supabase
    .from("restaurantes")
    .select("empresa_id")
    .eq("id", record.restaurante_id)
    .maybeSingle();

  const empresaId = restaurante?.empresa_id;
  const recipients = empresaId != null ? EMPRESA_RECIPIENTS[empresaId] : undefined;
  if (!recipients || recipients.length === 0) {
    return Response.json({ ok: true, skipped: "empresa-sin-destinatarios" });
  }

  // Deduplicación: no reenviar la misma reseña dos veces (reintentos del webhook, etc.).
  const { data: yaEnviado } = await supabase
    .from("whatsapp_alertas_enviadas")
    .select("resena_id")
    .eq("resena_id", record.id)
    .maybeSingle();
  if (yaEnviado) {
    return Response.json({ ok: true, skipped: "ya-enviado" });
  }

  const origin = new URL(request.url).origin;
  const imageUrl = `${origin}/api/notifications/whatsapp-alert-image?resena_id=${record.id}&token=${secret}`;
  const caption = "⚠️ Nueva reseña negativa detectada — Nexo Origen";

  const results = await Promise.all(
    recipients.map((to) => sendWhatsAppImageAlert({ to, mediaUrl: imageUrl, caption }))
  );

  const anyFailed = results.some((r) => !r.ok);
  if (!anyFailed) {
    await supabase.from("whatsapp_alertas_enviadas").insert({ resena_id: record.id });
  }

  return Response.json({ ok: !anyFailed, results });
}
