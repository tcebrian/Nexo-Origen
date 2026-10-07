import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { outboundRepository } from "@/lib/conversations/outbound.server";
import { isValidConversationId, mapMessageRow } from "@/lib/conversations/read-model";
import { monthlyReportSource } from "@/lib/conversations/report-delivery.server";
import { parseSendReportBody, sendMonthlyReport } from "@/lib/conversations/report-send";
import { errorReply } from "@/lib/conversations/send-reply";
import {
  isWhatsAppSenderConfigured,
  sendDocumentMessage,
  sendImageMessage,
  sendTextMessage,
  uploadMedia,
} from "@/lib/whatsapp/cloud-api.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby + Fluid Compute permite hasta 300 s. Una operación
// hace: generar PDF + subir a Meta (máx. 20 s) + enviar (máx. 15 s) + guardar.
// Si la función muriera por tiempo, la fila queda `pending` y NO se reenvía nada.
export const maxDuration = 120;

const UPLOAD_TIMEOUT_MS = 20_000;
const SEND_TIMEOUT_MS = 15_000;

/**
 * Envía por WhatsApp un informe de Nexo generado en servidor (PDF o imagen).
 * Body: { requestId, reportType: "monthly", format?: "pdf" | "image", restaurantId, offset }.
 * El navegador solo manda identificadores: nunca bytes, teléfono, canal ni media_id.
 */
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
  const parsed = parseSendReportBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await sendMonthlyReport(
      {
        conversationId,
        requestId: parsed.requestId,
        format: parsed.format,
        restaurantId: parsed.restaurantId,
        offset: parsed.offset,
      },
      monthlyReportSource(auth.session.scope),
      {
        repository: outboundRepository,
        sendText: sendTextMessage,
        uploadMedia: (input) => uploadMedia(input, { timeoutMs: UPLOAD_TIMEOUT_MS }),
        sendDocument: (input) => sendDocumentMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
        sendImage: (input) => sendImageMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
        isConfigured: isWhatsAppSenderConfigured,
      }
    );

    if (outcome.status !== "sent") {
      const reply = errorReply(outcome);
      return NextResponse.json(
        { error: reply.error, code: reply.code, messages: outcome.sent.map(mapMessageRow) },
        { status: reply.status }
      );
    }
    return NextResponse.json(
      { messages: outcome.messages.map(mapMessageRow), deduplicated: outcome.deduplicated },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[conversations] report send failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo enviar el informe" }, { status: 500 });
  }
}
