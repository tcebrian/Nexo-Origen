import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { sendManualActivation } from "@/lib/conversations/contact-activation.server";
import { isValidConversationId, mapMessageRow } from "@/lib/conversations/read-model";
import { errorReply } from "@/lib/conversations/send-reply";
import { describeTemplateRejection } from "@/lib/whatsapp/provider-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Botón manual "Enviar activación" de la ficha del contacto: envía la plantilla
 * `bienvenido_nexo` con el nombre del contacto como {{1}}. Solo super_admin.
 * No lleva cuerpo: ni plantilla, ni teléfono, ni canal los elige el navegador.
 * Nunca se llama solo (ni al crear el contacto, ni por scheduler, ni con reintentos).
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

  try {
    const outcome = await sendManualActivation(conversationId);

    switch (outcome.status) {
      case "sent":
        return NextResponse.json(
          { whatsapp: outcome.whatsapp, messages: outcome.messages.map(mapMessageRow) },
          { headers: { "Cache-Control": "no-store" } }
        );
      case "contact_not_found":
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      case "already_sent":
        return NextResponse.json({ error: "La activación ya se envió", code: "already_sent" }, { status: 409 });
      case "already_active":
        return NextResponse.json({ error: "El contacto ya está activo", code: "already_active" }, { status: 409 });
      case "rejected": {
        // Meta rechazó la plantilla: se registra el motivo exacto (sin teléfono ni token) y se muestra al super_admin.
        const meta = outcome.providerError;
        console.error(
          `[conversations] activation_rejected conversationId=${conversationId} template=bienvenido_nexo` +
            ` metaCode=${meta?.code ?? "-"} metaSubcode=${meta?.subcode ?? "-"} metaType=${meta?.type ?? "-"}` +
            ` http=${meta?.httpStatus ?? "-"} fbtrace=${meta?.fbtraceId ?? "-"}`
        );
        const { message, detail } = describeTemplateRejection(meta);
        return NextResponse.json(
          {
            error: message,
            code: "rejected",
            ...(detail ? { detail } : {}),
            ...(meta ? { provider: { code: meta.code ?? null, subcode: meta.subcode ?? null, type: meta.type ?? null, httpStatus: meta.httpStatus } } : {}),
          },
          { status: 502 }
        );
      }
      default: {
        const reply = errorReply(outcome);
        return NextResponse.json({ error: reply.error, code: reply.code }, { status: reply.status });
      }
    }
  } catch (error) {
    console.error("[conversations] activation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo enviar la activación" }, { status: 500 });
  }
}
