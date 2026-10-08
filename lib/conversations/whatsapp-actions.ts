import { ACTION_BUTTONS, WHATSAPP_ACTIONS, type WhatsAppAction, type WhatsAppActionName } from "@/lib/conversations/whatsapp-templates";

/**
 * ¿Qué quiere hacer la persona con este mensaje entrante? Función pura.
 *
 *  1. Botón con `payload`/`id` conocido → esa acción (identificador estable de Nexo).
 *  2. Botón sin payload reconocible → el texto del botón, solo si coincide EXACTAMENTE
 *     (sin distinguir mayúsculas) con el de un botón de Nexo. Nunca coincidencias parciales.
 *  3. Texto normal "ok" (solo eso) → ACTIVATE_SERVICE, y solo si el contacto aún está
 *     pendiente de activar. Nada más se interpreta desde texto libre.
 *  4. Todo lo demás → UNKNOWN (no se ejecuta nada).
 */

export type ActionMessage = {
  contentType: string;
  text?: string;
  /** Respuesta a un botón (quick reply de plantilla o botón interactivo). */
  interactive?: { id?: string; title?: string };
};

function normalize(value: string | undefined): string {
  return (value ?? "").normalize("NFC").trim().toLowerCase();
}

export function resolveWhatsAppAction(message: ActionMessage, context: { activationPending: boolean }): WhatsAppAction {
  const button = message.interactive;

  if (button) {
    const id = button.id?.trim();
    if (id) {
      const byPayload = WHATSAPP_ACTIONS.find((action) => ACTION_BUTTONS[action].payload === id);
      if (byPayload) return byPayload;
    }
    // Plantillas enviadas sin payload propio: Meta devuelve el texto del botón como payload.
    const label = normalize(button.title) || normalize(id);
    const byTitle = WHATSAPP_ACTIONS.find((action) => normalize(ACTION_BUTTONS[action].title) === label);
    return byTitle ?? "UNKNOWN";
  }

  if (message.contentType === "text" && context.activationPending && normalize(message.text) === "ok") {
    return "ACTIVATE_SERVICE";
  }

  return "UNKNOWN";
}

export type { WhatsAppAction, WhatsAppActionName };
