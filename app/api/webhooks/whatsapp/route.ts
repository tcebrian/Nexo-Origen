import {
  handleWebhookEvent,
  handleWebhookVerification,
  type WebhookHttpResult,
} from "@/lib/conversations/channels/whatsapp-cloud/webhook-handler";
import { applyWhatsAppMessageStatus } from "@/lib/conversations/apply-message-status";
import { ingestInboundMessage } from "@/lib/conversations/ingest-inbound";
import { runInboundAction } from "@/lib/conversations/contact-activation.server";
import { messageStatusRepository } from "@/lib/conversations/status.server";
import { conversationsRepository } from "@/lib/supabase/conversations.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de WhatsApp Cloud API (Meta). Público a nivel de sesión de Nexo:
 * `/api/webhooks/` está exento en `lib/auth/route-guard.ts`. La autenticación
 * es el token de verificación (GET) y la firma HMAC del cuerpo (POST).
 */

function toResponse(result: WebhookHttpResult): Response {
  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": `${result.contentType}; charset=utf-8` },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(
    handleWebhookVerification(
      {
        mode: params.get("hub.mode"),
        token: params.get("hub.verify_token"),
        challenge: params.get("hub.challenge"),
      },
      { verifyToken: process.env.WHATSAPP_CLOUD_VERIFY_TOKEN }
    )
  );
}

export async function POST(request: Request) {
  // Cuerpo en bruto: la firma se calcula sobre los bytes exactos recibidos.
  let rawBody: Uint8Array;
  try {
    rawBody = new Uint8Array(await request.arrayBuffer());
  } catch {
    return toResponse({ status: 400, body: JSON.stringify({ ok: false }), contentType: "application/json" });
  }

  return toResponse(
    await handleWebhookEvent(
      { rawBody, signature: request.headers.get("x-hub-signature-256") },
      {
        appSecret: process.env.WHATSAPP_CLOUD_APP_SECRET,
        ingest: (message) => ingestInboundMessage(conversationsRepository, "whatsapp_cloud", message),
        handleAction: runInboundAction,
        applyStatus: (update) => applyWhatsAppMessageStatus(messageStatusRepository, "whatsapp_cloud", update),
      }
    )
  );
}
