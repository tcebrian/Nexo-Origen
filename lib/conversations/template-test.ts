import {
  WELCOME_NAME_FALLBACK,
  type ActivationDeps,
} from "@/lib/conversations/contact-activation";
import {
  sendConversationOperation,
  type OutboundRecord,
  type SendContext,
  type SendFailureStatus,
} from "@/lib/conversations/send-text";
import type { RejectionReason } from "@/lib/whatsapp/cloud-api.server";
import { WHATSAPP_TEMPLATES, buildTemplateRequest, type TemplateRequest, type WhatsAppTemplateName } from "@/lib/conversations/whatsapp-templates";
import type { ProviderError } from "@/lib/whatsapp/provider-error";

/**
 * PRUEBA MANUAL y TEMPORAL de las plantillas `informe_diario` y `alerta_negativa`: el super_admin las
 * envía desde una conversación para comprobar que Meta las acepta.
 *
 * Usa exactamente el sistema de envío de Conversations (`sendConversationOperation`: reserva idempotente,
 * `pending → sent`, estados de entrega por webhook): no es una llamada paralela. Un solo mensaje, y NO
 * toca `welcome_sent_at`, `whatsapp_activated_at`, permisos ni ninguna automatización.
 */

export const TEST_TEMPLATE_KINDS = {
  daily_report: { template: "informe_diario" as const, label: "informe diario" },
  negative_alert: { template: "alerta_negativa" as const, label: "alerta negativa" },
  /** Igual que `negative_alert` pero forzando la plantilla aunque la ventana esté abierta. */
  negative_alert_template: { template: "alerta_negativa" as const, label: "alerta negativa (plantilla)" },
} satisfies Record<string, { template: WhatsAppTemplateName; label: string }>;

export type TestTemplateKind = keyof typeof TEST_TEMPLATE_KINDS;

export function isTestTemplateKind(value: unknown): value is TestTemplateKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TEST_TEMPLATE_KINDS, value);
}

const longDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

/** "8 de octubre de 2026". */
export function formatSpanishLongDate(date: Date): string {
  return longDate.format(date);
}

/** Número de alertas de la prueba: siempre "1". */
export const TEST_ALERT_COUNT = "1";

/** Variables de la prueba: {{1}} nombre real del contacto; {{2}} fecha de hoy (informe) o "1" (alerta). */
export function buildTestTemplateRequest(kind: TestTemplateKind, input: { name: string | null; now: Date }): TemplateRequest {
  const name = input.name?.trim() || WELCOME_NAME_FALLBACK;
  const second = kind === "daily_report" ? formatSpanishLongDate(input.now) : TEST_ALERT_COUNT;
  return buildTemplateRequest(TEST_TEMPLATE_KINDS[kind].template, [name, second]);
}

export type TestTemplateOutcome =
  | { status: "sent"; messages: OutboundRecord[]; template: WhatsAppTemplateName }
  | { status: "contact_not_found" }
  | { status: SendFailureStatus; reason?: RejectionReason; providerError?: ProviderError; sent: OutboundRecord[]; template: WhatsAppTemplateName };

export async function sendTestTemplate(
  input: { conversationId: string; kind: TestTemplateKind; requestId: string },
  deps: ActivationDeps
): Promise<TestTemplateOutcome> {
  const now = deps.now ?? (() => new Date());

  const contact = await deps.activations.getByConversation(input.conversationId);
  if (!contact) return { status: "contact_not_found" };

  const template = buildTestTemplateRequest(input.kind, { name: contact.name, now: now() });

  const outcome = await sendConversationOperation(
    {
      conversationId: input.conversationId,
      // Lo genera la interfaz en cada pulsación: un doble clic no duplica; una pulsación nueva envía otro.
      requestId: input.requestId,
      text: "",
      template: {
        display: `${WHATSAPP_TEMPLATES[template.name].display} (prueba)`,
        send: (context: SendContext) =>
          deps.sendTemplate({ phoneNumberId: context.canal.externalAccountId, to: context.contactPhone, template }),
      },
    },
    deps.send
  );

  if (outcome.status !== "sent") return { ...outcome, template: template.name };
  return { status: "sent", messages: outcome.messages, template: template.name };
}
