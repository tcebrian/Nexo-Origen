import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { sendManualTestTemplate } from "@/lib/conversations/contact-activation.server";
import { isValidConversationId, mapMessageRow } from "@/lib/conversations/read-model";
import { errorReply } from "@/lib/conversations/send-reply";
import { isValidRequestId } from "@/lib/conversations/send-text";
import { isTestTemplateKind } from "@/lib/conversations/template-test";
import { describeTemplateRejection } from "@/lib/whatsapp/provider-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PRUEBA MANUAL y TEMPORAL (solo super_admin): envía `informe_diario` o `alerta_negativa` al contacto de
 * la conversación. Body: { kind: "daily_report" | "negative_alert", requestId }.
 * La plantilla, el idioma y las variables los decide el servidor: el navegador solo elige el tipo.
 * Usa el mismo envío de Conversations que producción; no cambia activación, permisos ni automatizaciones.
 */
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { kind?: unknown; requestId?: unknown } | null;
  if (!isTestTemplateKind(body?.kind)) return NextResponse.json({ error: "Tipo de prueba no válido" }, { status: 400 });
  if (!isValidRequestId(body?.requestId)) return NextResponse.json({ error: "requestId no válido" }, { status: 400 });

  try {
    const outcome = await sendManualTestTemplate({ conversationId, kind: body.kind, requestId: body.requestId });

    if (outcome.status === "sent") {
      return NextResponse.json(
        { template: outcome.template, messages: outcome.messages.map(mapMessageRow) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (outcome.status === "contact_not_found") {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    if (outcome.status === "rejected") {
      const meta = outcome.providerError;
      console.error(
        `[conversations] template_test_rejected conversationId=${conversationId} template=${outcome.template}` +
          ` metaCode=${meta?.code ?? "-"} metaSubcode=${meta?.subcode ?? "-"} metaType=${meta?.type ?? "-"}` +
          ` http=${meta?.httpStatus ?? "-"} fbtrace=${meta?.fbtraceId ?? "-"}`
      );
      const { message, detail } = describeTemplateRejection(meta);
      return NextResponse.json({ error: message, code: "rejected", ...(detail ? { detail } : {}) }, { status: 502 });
    }

    const reply = errorReply(outcome);
    return NextResponse.json({ error: reply.error, code: reply.code }, { status: reply.status });
  } catch (error) {
    console.error("[conversations] template test failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo enviar la plantilla de prueba" }, { status: 500 });
  }
}
