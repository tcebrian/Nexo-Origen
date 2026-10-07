import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { isValidConversationId, mapMessageRow } from "@/lib/conversations/read-model";
import { getConversationMessages } from "@/lib/conversations/read.server";
import { outboundRepository } from "@/lib/conversations/outbound.server";
import { errorReply } from "@/lib/conversations/send-reply";
import { parseSendFields, sendConversationOperation } from "@/lib/conversations/send-text";
import {
  isWhatsAppSenderConfigured,
  sendDocumentMessage,
  sendTextMessage,
  uploadMedia,
} from "@/lib/whatsapp/cloud-api.server";

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
  const parsed = parseSendFields(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await sendConversationOperation(
      { conversationId, requestId: parsed.requestId, text: parsed.text },
      {
        repository: outboundRepository,
        sendText: sendTextMessage,
        uploadMedia,
        sendDocument: sendDocumentMessage,
        isConfigured: isWhatsAppSenderConfigured,
      }
    );

    if (outcome.status !== "sent") {
      const reply = errorReply(outcome);
      return NextResponse.json(
        {
          error: reply.error,
          code: reply.code,
          // Mensajes de la operación que sí se enviaron antes del fallo.
          messages: outcome.sent.map(mapMessageRow),
        },
        { status: reply.status }
      );
    }
    return NextResponse.json(
      { messages: outcome.messages.map(mapMessageRow), deduplicated: outcome.deduplicated },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[conversations] send failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
