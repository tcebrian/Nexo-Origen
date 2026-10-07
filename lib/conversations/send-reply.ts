import type { SendFailureStatus } from "@/lib/conversations/send-text";

export type SendErrorReply = { status: number; code: string; error: string };

/**
 * Respuestas HTTP seguras para la interfaz ante un envío que no se completó:
 * nunca detalles de Meta, de la base de datos ni del contenido enviado.
 */
export function errorReply(outcome: {
  status: SendFailureStatus | "report_not_found";
  reason?: string;
}): SendErrorReply {
  switch (outcome.status) {
    case "not_found":
      return { status: 404, code: "not_found", error: "Conversación no encontrada" };
    case "report_not_found":
      return { status: 404, code: "report_not_found", error: "Restaurante o periodo no disponible" };
    case "channel_inactive":
      return { status: 409, code: "channel_inactive", error: "El canal de WhatsApp no está activo" };
    case "misconfigured":
      return { status: 500, code: "config", error: "El envío no está configurado en el servidor" };
    case "in_progress":
      return {
        status: 409,
        code: "in_progress",
        error:
          "Este mensaje ya se envió o está pendiente de confirmar. Comprueba la conversación antes de reenviarlo.",
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
    case "generation_failed":
      return {
        status: 500,
        code: "generation_failed",
        error: "No se pudo generar el informe. No se ha enviado nada; puedes reintentarlo.",
      };
    case "upload_failed":
      return {
        status: 502,
        code: "upload_failed",
        error: "No se pudo subir el archivo a WhatsApp. No se ha enviado nada; puedes reintentarlo.",
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
