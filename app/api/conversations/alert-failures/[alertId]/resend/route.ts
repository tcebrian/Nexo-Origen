import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { isValidConversationId as isUuid } from "@/lib/conversations/read-model";
import { resendNegativeAlert } from "@/lib/alerts/negative-review/process.server";
import type { ManualResendResult } from "@/lib/alerts/negative-review/orchestrator";
import { rateLimitAuthenticatedUser } from "@/lib/security/rate-limit.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generar la imagen (Chromium) + subir + enviar imagen y texto.
export const maxDuration = 60;

/** Respuesta para la interfaz: estado HTTP, si llegó y un mensaje claro. Nunca teléfonos ni detalles de Meta. */
function reply(result: ManualResendResult): { status: number; ok: boolean; message: string } {
  switch (result.status) {
    case "delivered":
      return { status: 200, ok: true, message: "Alerta reenviada: la imagen y el enlace han llegado al contacto." };
    case "template_sent":
      return {
        status: 200,
        ok: true,
        message: "Han pasado más de 24 h desde su último mensaje: se le ha enviado el aviso «Ver alerta».",
      };
    case "waiting_template":
      return {
        status: 200,
        ok: true,
        message: "Ventana de 24 h cerrada y ya tiene un aviso «Ver alerta» sin atender: la alerta llegará cuando lo pulse.",
      };
    case "not_found":
      return { status: 404, ok: false, message: "La alerta o el contacto ya no existen." };
    case "not_resendable":
      return { status: 409, ok: false, message: "Esta alerta ya no está pendiente (puede que ya se haya entregado)." };
    case "busy":
      return { status: 409, ok: false, message: "Esta alerta se está enviando ahora mismo. Espera unos segundos." };
    case "no_access":
      return { status: 409, ok: false, message: "El contacto ya no tiene acceso a ese restaurante: no se envía." };
    case "alerts_disabled":
      return { status: 409, ok: false, message: "El contacto tiene desactivadas las alertas de reseñas negativas." };
    case "not_activated":
      return { status: 409, ok: false, message: "El contacto aún no ha activado WhatsApp: no se le puede escribir todavía." };
    case "failed":
      return {
        status: 502,
        ok: false,
        message: result.uncertain
          ? "No se pudo confirmar el envío. Revisa la conversación antes de volver a intentarlo."
          : "Ha vuelto a fallar. El motivo queda actualizado en la lista.",
      };
  }
}

/** Reenvía a mano una alerta de reseña negativa que no llegó (página "Fallos de envío", super_admin). */
export async function POST(request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limited = await rateLimitAuthenticatedUser("conversation-alert-resend", auth.session.userId);
  if (limited) return limited;

  const { alertId } = await params;
  if (!isUuid(alertId)) {
    return NextResponse.json({ error: "Identificador de alerta no válido" }, { status: 400 });
  }

  try {
    const result = await resendNegativeAlert(alertId);
    const { status, ok, message } = reply(result);
    return NextResponse.json({ ok, result: result.status, message }, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[alert-failures] resend failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "No se pudo reenviar la alerta" }, { status: 500 });
  }
}
