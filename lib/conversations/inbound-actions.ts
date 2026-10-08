import { deriveStableRequestId } from "@/lib/conversations/request-ids";
import { resolveWhatsAppAction } from "@/lib/conversations/whatsapp-actions";
import type { WhatsAppActionName } from "@/lib/conversations/whatsapp-templates";
import type { InboundMessage } from "@/lib/conversations/types";

/**
 * Acciones que la persona dispara desde WhatsApp (botones de plantilla u "OK").
 *
 *   mensaje entrante ya guardado → ¿qué acción es? (`resolveWhatsAppAction`) → handler de la acción
 *
 * Un handler por acción (`INBOUND_ACTION_HANDLERS`): "Ver informe" y "Ver alertas" ya están
 * reconocidas y enlazadas al contacto; hoy solo confirman la recepción y el siguiente bloque
 * sustituirá su cuerpo por el informe y las alertas reales (sin tocar el reconocimiento).
 *
 * Reglas:
 *  - Activar WhatsApp NO cambia permisos: solo guarda `whatsapp_activated_at`.
 *  - Idempotente: la activación solo escribe si sigue en NULL (una segunda pulsación no
 *    cambia la fecha) y cada respuesta usa un id derivado del mensaje entrante, así que un
 *    webhook repetido no vuelve a responder.
 *  - Sin IA, sin informes ni alertas reales, sin scheduler.
 */

export const ACTIVATION_REPLY =
  "✅ Servicio activado.\n\nA partir de ahora recibirás la información de los restaurantes que tienes asignados en Nexo Origen. 💜";
export const REPORT_REQUEST_REPLY = "📊 Solicitud de informe recibida.";
export const ALERTS_REQUEST_REPLY = "🚨 Solicitud de alertas recibida.";

export type InboundActionContext = {
  message: InboundMessage;
  contactId: string;
  conversationId: string;
  /** El webhook es una reentrega de un mensaje ya guardado. */
  redelivery: boolean;
  /** Responde con un texto normal; idempotente por `requestId`. */
  reply: (text: string) => Promise<void>;
  activations: InboundActivationRepository;
  now: () => Date;
};

export interface InboundActivationRepository {
  /** `null` si el contacto no existe. */
  isActivated(contactId: string): Promise<boolean | null>;
  /** Escribe `whatsapp_activated_at` solo si sigue en NULL. `true` si esta llamada la activó. */
  markActivated(contactId: string, at: Date): Promise<boolean>;
}

export type InboundActionHandler = (context: InboundActionContext) => Promise<void>;

export const INBOUND_ACTION_HANDLERS: Record<WhatsAppActionName, InboundActionHandler> = {
  async ACTIVATE_SERVICE(context) {
    const activatedNow = await context.activations.markActivated(context.contactId, context.now());
    // Responde al activar y al reintentar ESE mismo mensaje (el id derivado evita duplicados).
    // Una pulsación posterior con el servicio ya activo no genera otra respuesta.
    if (activatedNow || context.redelivery) await context.reply(ACTIVATION_REPLY);
  },
  async VIEW_DAILY_REPORT(context) {
    await context.reply(REPORT_REQUEST_REPLY);
  },
  async VIEW_PENDING_ALERTS(context) {
    await context.reply(ALERTS_REQUEST_REPLY);
  },
};

export type InboundActionDeps = {
  activations: InboundActivationRepository;
  /** Envía un texto normal a la conversación. `requestId` hace el envío idempotente. */
  sendReply: (input: { conversationId: string; requestId: string; text: string }) => Promise<void>;
  now?: () => Date;
};

/** Resultado para registros (nunca teléfonos ni textos). */
export type InboundActionResult = { action: WhatsAppActionName | "UNKNOWN" | "skipped" };

export async function handleInboundAction(
  input: { message: InboundMessage; contactId: string; conversationId: string; redelivery: boolean },
  deps: InboundActionDeps
): Promise<InboundActionResult> {
  const { message, contactId, conversationId } = input;

  // Un mensaje sin botón ni texto no puede ser una acción: ni se consulta la base de datos.
  if (!message.interactive && !(message.contentType === "text" && message.text)) return { action: "skipped" };

  const activated = await deps.activations.isActivated(contactId);
  if (activated === null) return { action: "skipped" };

  const action = resolveWhatsAppAction(message, { activationPending: !activated });
  if (action === "UNKNOWN") return { action: "UNKNOWN" };

  await INBOUND_ACTION_HANDLERS[action]({
    message,
    contactId,
    conversationId,
    redelivery: input.redelivery,
    activations: deps.activations,
    now: deps.now ?? (() => new Date()),
    // Un id por (mensaje entrante, acción): reentregar el webhook no duplica la respuesta.
    reply: (text) =>
      deps.sendReply({
        conversationId,
        requestId: deriveStableRequestId(`reply:${action}:${message.externalMessageId}`),
        text,
      }),
  });

  return { action };
}
