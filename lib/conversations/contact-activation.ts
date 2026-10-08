import { deriveStableRequestId } from "@/lib/conversations/request-ids";
import {
  sendConversationOperation,
  type SendDeps,
  type SendFailureStatus,
  type OutboundRecord,
  type SendContext,
} from "@/lib/conversations/send-text";
import { WHATSAPP_TEMPLATES, buildTemplateRequest } from "@/lib/conversations/whatsapp-templates";
import type { RejectionReason, SendMessageResult, SendTemplateInput } from "@/lib/whatsapp/cloud-api.server";

/**
 * Activación MANUAL de un contacto de WhatsApp: el super_admin pulsa "Enviar activación" en
 * su ficha y se envía la plantilla `bienvenida_nexo`. Nada la envía solo: crear un contacto no
 * manda ninguna plantilla, ni hay scheduler ni reintentos automáticos.
 *
 * Estado del contacto (dos fechas, ver `contactWhatsAppState`):
 *   welcome_sent_at        → Meta aceptó la plantilla (se guarda SOLO si la aceptó).
 *   whatsapp_activated_at  → la persona pulsó "Activar servicio" (o escribió OK).
 *
 * Idempotencia: el id del mensaje se deriva del contacto, no del navegador. Un doble clic o un
 * reintento tras un fallo vuelven a la MISMA fila: si ya salió no se reenvía (y se repara
 * `welcome_sent_at` si faltaba), si está pendiente de confirmar se detiene, y si Meta la
 * rechazó se reintenta esa misma fila. Activar WhatsApp no cambia permisos de restaurantes.
 */

export type ContactActivation = {
  id: string;
  phone: string;
  /** Nombre para la variable {{1}}: nombre del contacto o nombre de perfil de WhatsApp. */
  name: string | null;
  welcomeSentAt: string | null;
  activatedAt: string | null;
};

export interface ContactActivationRepository {
  getByConversation(conversationId: string): Promise<ContactActivation | null>;
  /** Solo escribe si sigue en NULL. `false` si ya estaba guardada. */
  markWelcomeSent(contactId: string, at: Date): Promise<boolean>;
}

export type ContactWhatsAppState =
  | { state: "pending"; welcomeSentAt: null; activatedAt: null }
  | { state: "sent"; welcomeSentAt: string; activatedAt: null }
  | { state: "active"; welcomeSentAt: string | null; activatedAt: string };

/** Estado visible en la ficha: Activo manda sobre Activación enviada, que manda sobre Pendiente. */
export function contactWhatsAppState(contact: Pick<ContactActivation, "welcomeSentAt" | "activatedAt">): ContactWhatsAppState {
  if (contact.activatedAt) return { state: "active", welcomeSentAt: contact.welcomeSentAt, activatedAt: contact.activatedAt };
  if (contact.welcomeSentAt) return { state: "sent", welcomeSentAt: contact.welcomeSentAt, activatedAt: null };
  return { state: "pending", welcomeSentAt: null, activatedAt: null };
}

/** Variable {{1}} cuando el contacto no tiene nombre. */
export const WELCOME_NAME_FALLBACK = "equipo";

export type ActivationOutcome =
  | { status: "sent"; whatsapp: ContactWhatsAppState; messages: OutboundRecord[] }
  | { status: "contact_not_found" }
  | { status: "already_sent" | "already_active" }
  | { status: SendFailureStatus; reason?: RejectionReason; sent: OutboundRecord[] };

export type ActivationDeps = {
  activations: ContactActivationRepository;
  /** Persistencia y proveedor del envío (los mismos que usa el resto de Conversations). */
  send: SendDeps;
  sendTemplate: (input: SendTemplateInput) => Promise<SendMessageResult>;
  now?: () => Date;
};

export async function sendContactActivation(input: { conversationId: string }, deps: ActivationDeps): Promise<ActivationOutcome> {
  const now = deps.now ?? (() => new Date());

  const contact = await deps.activations.getByConversation(input.conversationId);
  if (!contact) return { status: "contact_not_found" };
  if (contact.activatedAt) return { status: "already_active" };
  if (contact.welcomeSentAt) return { status: "already_sent" };

  const template = buildTemplateRequest("bienvenida_nexo", [contact.name?.trim() || WELCOME_NAME_FALLBACK]);

  const outcome = await sendConversationOperation(
    {
      conversationId: input.conversationId,
      // Estable por contacto: ni un doble clic ni un reintento pueden duplicar la plantilla.
      requestId: deriveStableRequestId(`welcome:${contact.id}`),
      text: "",
      template: {
        display: WHATSAPP_TEMPLATES.bienvenida_nexo.display,
        send: (context: SendContext) =>
          deps.sendTemplate({ phoneNumberId: context.canal.externalAccountId, to: context.contactPhone, template }),
      },
    },
    deps.send
  );

  if (outcome.status !== "sent") return outcome;

  // Meta aceptó la plantilla (o ya la había aceptado en un intento anterior): se guarda la fecha.
  const sentAt = now();
  await deps.activations.markWelcomeSent(contact.id, sentAt);
  return {
    status: "sent",
    messages: outcome.messages,
    whatsapp: contactWhatsAppState({ welcomeSentAt: sentAt.toISOString(), activatedAt: null }),
  };
}
