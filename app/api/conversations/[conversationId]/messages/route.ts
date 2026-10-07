import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { isValidConversationId, mapMessageRow } from "@/lib/conversations/read-model";
import { getConversationMessages } from "@/lib/conversations/read.server";
import { outboundRepository } from "@/lib/conversations/outbound.server";
import {
  parseSendTextBody,
  sendTextMessageToConversation,
  type SendTextOutcome,
} from "@/lib/conversations/send-text";
import { isWhatsAppSenderConfigured, sendTextMessage } from "@/lib/whatsapp/cloud-api.server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  try {
    const messages = await getConversationMessages(conversationId);
    if (!messages) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[conversations] messages failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar los mensajes" }, { status: 500 });
  }
}

type ErrorReply = { status: number; code: string; error: string };

/** Respuestas seguras para la interfaz: nunca detalles de Meta ni de la base de datos. */
function errorReply(outcome: Exclude<SendTextOutcome, { status: "sent" }>): ErrorReply {
  switch (outcome.status) {
    case "not_found":
      return { status: 404, code: "not_found", error: "Conversación no encontrada" };
    case "channel_inactive":
      return { status: 409, code: "channel_inactive", error: "El canal de WhatsApp no está activo" };
    case "misconfigured":
      return { status: 500, code: "config", error: "El envío no está configurado en el servidor" };
    case "in_progress":
      return {
        status: 409,
        code: "in_progress",
        error: "Este mensaje ya se envió o está pendiente de confirmar. Comprueba la conversación antes de reenviarlo.",
      };
    case "request_conflict":
      return { status: 409, code: "request_conflict", error: "Petición de envío no válida" };
    case "rejected":
      return {
        status: 502,
        code: outcome.reason === "window_closed" ? "window_closed" : "rejected",
        error:
          outcome.reason === "window_closed"
            ? "Han pasado más de 24 h desde el último mensaje del contacto: WhatsApp solo permite plantillas."
            : "WhatsApp no aceptó el mensaje",
      };
    case "unconfirmed":
      return {
        status: 502,
        code: "unconfirmed",
        error: "No se pudo confirmar el envío. Comprueba la conversación antes de reenviarlo.",
      };
    case "sent_not_saved":
      return {
        status: 500,
        code: "sent_not_saved",
        error: "El mensaje se envió pero no se pudo guardar. No lo reenvíes.",
      };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  // Solo `text` y `requestId`: teléfono, canal y sender se resuelven en servidor.
  const parsed = parseSendTextBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await sendTextMessageToConversation(
      { conversationId, requestId: parsed.requestId, text: parsed.text },
      {
        repository: outboundRepository,
        sendText: sendTextMessage,
        isConfigured: isWhatsAppSenderConfigured,
      }
    );

    if (outcome.status !== "sent") {
      const reply = errorReply(outcome);
      return NextResponse.json({ error: reply.error, code: reply.code }, { status: reply.status });
    }
    return NextResponse.json(
      { message: mapMessageRow(outcome.message), deduplicated: outcome.deduplicated },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[conversations] send failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
