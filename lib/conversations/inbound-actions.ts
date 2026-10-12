import { deriveStableRequestId } from "@/lib/conversations/request-ids";
import { resolveWhatsAppAction } from "@/lib/conversations/whatsapp-actions";
import type { WhatsAppActionName } from "@/lib/conversations/whatsapp-templates";
import type { InboundMessage } from "@/lib/conversations/types";
import type { PendingAlertsResult } from "@/lib/alerts/negative-review/orchestrator";
import type { DailyReportViewResult } from "@/lib/reports/daily/view";

/**
 * Acciones que la persona dispara desde WhatsApp (botones de plantilla u "OK").
 *
 *   mensaje entrante ya guardado → ¿qué acción es? (`resolveWhatsAppAction`) → handler de la acción
 *
 * Un handler por acción (`INBOUND_ACTION_HANDLERS`): "Ver informe" y "Ver alerta" ya están
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
export const REPORT_NOT_FOUND_REPLY =
  "📊 No encuentro un informe reciente para enviarte. El próximo te llegará a las 09:00.";
export const REPORT_NO_ACCESS_REPLY = "🔒 Ahora mismo no tienes restaurantes asignados en Nexo Origen, así que no hay informe que mostrar.";
export const ALERTS_REQUEST_REPLY = "🚨 Solicitud de alertas recibida.";
export const ALERTS_NONE_REPLY = "✅ No tienes alertas pendientes ahora mismo.";
export const ALERTS_NO_ACCESS_REPLY = "🔒 Ahora mismo no tienes restaurantes asignados en Nexo Origen, así que no hay alertas que mostrar.";
export const ALERTS_FAILED_REPLY = "⚠️ No he podido enviarte la alerta ahora mismo. Vuelve a pulsar «Ver alerta» en unos minutos.";
export const alertsRemainingReply = (remaining: number) =>
  `📌 Tienes ${remaining} ${remaining === 1 ? "alerta más" : "alertas más"} pendiente${remaining === 1 ? "" : "s"}. Te las enviaremos con el siguiente aviso.`;

export type InboundActionContext = {
  message: InboundMessage;
  contactId: string;
  conversationId: string;
  /** El webhook es una reentrega de un mensaje ya guardado. */
  redelivery: boolean;
  /** Responde con un texto normal; idempotente por `requestId`. */
  reply: (text: string) => Promise<void>;
  /** Varios mensajes en orden, cada uno con su propio id derivado (idempotente). */
  replyParts: (texts: string[]) => Promise<void>;
  /** Informe diario asociado al aviso pulsado (snapshot guardado). Ausente → respuesta provisional. */
  viewDailyReport?: () => Promise<DailyReportViewResult>;
  /** Entrega las alertas negativas pendientes del contacto (imagen + texto). Ausente → respuesta provisional. */
  viewPendingAlerts?: () => Promise<PendingAlertsResult>;
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
    if (!context.viewDailyReport) {
      await context.reply(REPORT_REQUEST_REPLY);
      return;
    }
    // El informe sale de la foto guardada a las 09:00 del aviso pulsado: no se recalcula nada.
    const view = await context.viewDailyReport();
    if (view.status === "report") await context.replyParts(view.messages);
    else if (view.status === "no_access") await context.reply(REPORT_NO_ACCESS_REPLY);
    else await context.reply(REPORT_NOT_FOUND_REPLY);
  },
  async VIEW_PENDING_ALERTS(context) {
    if (!context.viewPendingAlerts) {
      await context.reply(ALERTS_REQUEST_REPLY);
      return;
    }
    // La imagen y el texto de cada alerta los envía la propia entrega; aquí solo se responde lo que falta.
    const result = await context.viewPendingAlerts();
    if (result.status === "no_access") await context.reply(ALERTS_NO_ACCESS_REPLY);
    else if (result.status === "none") {
      // En una reentrega del mismo clic, "ninguna pendiente" suele significar que ya se entregaron.
      if (!context.redelivery) await context.reply(ALERTS_NONE_REPLY);
    } else if (result.delivered === 0 && result.failed > 0) await context.reply(ALERTS_FAILED_REPLY);
    else if (result.remaining > 0) await context.reply(alertsRemainingReply(result.remaining));
  },
};

export type InboundActionDeps = {
  activations: InboundActivationRepository;
  /** Envía un texto normal a la conversación. `requestId` hace el envío idempotente. */
  sendReply: (input: { conversationId: string; requestId: string; text: string }) => Promise<void>;
  /** Resuelve el informe diario del aviso pulsado (snapshot). Opcional. */
  viewDailyReport?: (input: { contactId: string; replyToWamid: string | null; redelivery: boolean }) => Promise<DailyReportViewResult>;
  /** Entrega las alertas negativas pendientes del contacto. Opcional. */
  viewPendingAlerts?: (input: { contactId: string; conversationId: string }) => Promise<PendingAlertsResult>;
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
    replyParts: async (texts) => {
      for (const [index, text] of texts.entries()) {
        await deps.sendReply({
          conversationId,
          // El primero conserva el id de siempre; los siguientes añaden su posición.
          requestId: deriveStableRequestId(
            index === 0 ? `reply:${action}:${message.externalMessageId}` : `reply:${action}:${message.externalMessageId}:${index}`
          ),
          text,
        });
      }
    },
    viewDailyReport: deps.viewDailyReport
      ? () =>
          deps.viewDailyReport!({
            contactId,
            replyToWamid: message.replyToExternalId ?? null,
            redelivery: input.redelivery,
          })
      : undefined,
    viewPendingAlerts: deps.viewPendingAlerts ? () => deps.viewPendingAlerts!({ contactId, conversationId }) : undefined,
  });

  return { action };
}
