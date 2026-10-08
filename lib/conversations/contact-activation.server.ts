import "server-only";

import {
  handleInboundAction,
  type InboundActionResult,
  type InboundActivationRepository,
} from "@/lib/conversations/inbound-actions";
import {
  sendContactActivation,
  type ActivationOutcome,
  type ContactActivation,
  type ContactActivationRepository,
} from "@/lib/conversations/contact-activation";
import { outboundRepository } from "@/lib/conversations/outbound.server";
import { sendConversationOperation, type SendDeps } from "@/lib/conversations/send-text";
import type { InboundMessage } from "@/lib/conversations/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ConversationsDbError } from "@/lib/supabase/conversations.server";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import {
  isWhatsAppSenderConfigured,
  sendDocumentMessage,
  sendImageMessage,
  sendTemplateMessage,
  sendTextMessage,
  uploadMedia,
} from "@/lib/whatsapp/cloud-api.server";

/**
 * Persistencia y cableado de producción de la activación de contactos de WhatsApp (solo servidor,
 * service role). La lógica vive en `contact-activation.ts` e `inbound-actions.ts`.
 * Solo se leen/escriben `welcome_sent_at` y `whatsapp_activated_at`; ningún permiso.
 */

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

type ContactRow = {
  id: string;
  telefono_e164: string;
  nombre: string | null;
  nombre_perfil: string | null;
  welcome_sent_at: string | null;
  whatsapp_activated_at: string | null;
};

const COLUMNS = "id,telefono_e164,nombre,nombre_perfil,welcome_sent_at,whatsapp_activated_at";

function mapRow(row: ContactRow): ContactActivation {
  return {
    id: row.id,
    phone: row.telefono_e164,
    name: row.nombre?.trim() || row.nombre_perfil?.trim() || null,
    welcomeSentAt: row.welcome_sent_at ?? null,
    activatedAt: row.whatsapp_activated_at ?? null,
  };
}

export const contactActivationRepository: ContactActivationRepository & InboundActivationRepository = {
  async getByConversation(conversationId) {
    const client = requireAdminClient();
    const { data: conversation, error } = await client
      .from(SUPABASE_TABLES.conv_conversaciones)
      .select("contacto_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw new ConversationsDbError("activation.conversation", error.code);
    const contactId = (conversation as { contacto_id: string } | null)?.contacto_id;
    if (!contactId) return null;

    const { data, error: contactError } = await client
      .from(SUPABASE_TABLES.conv_contactos)
      .select(COLUMNS)
      .eq("id", contactId)
      .maybeSingle();
    if (contactError) throw new ConversationsDbError("activation.contact", contactError.code);
    return data ? mapRow(data as ContactRow) : null;
  },

  async markWelcomeSent(contactId, at) {
    const { data, error } = await requireAdminClient()
      .from(SUPABASE_TABLES.conv_contactos)
      .update({ welcome_sent_at: at.toISOString(), updated_at: at.toISOString() })
      .eq("id", contactId)
      .is("welcome_sent_at", null)
      .select("id");
    if (error) throw new ConversationsDbError("activation.markWelcomeSent", error.code);
    return (data?.length ?? 0) > 0;
  },

  async isActivated(contactId) {
    const { data, error } = await requireAdminClient()
      .from(SUPABASE_TABLES.conv_contactos)
      .select("whatsapp_activated_at")
      .eq("id", contactId)
      .maybeSingle();
    if (error) throw new ConversationsDbError("activation.isActivated", error.code);
    if (!data) return null;
    return (data as { whatsapp_activated_at: string | null }).whatsapp_activated_at !== null;
  },

  async markActivated(contactId, at) {
    const { data, error } = await requireAdminClient()
      .from(SUPABASE_TABLES.conv_contactos)
      .update({ whatsapp_activated_at: at.toISOString(), updated_at: at.toISOString() })
      .eq("id", contactId)
      .is("whatsapp_activated_at", null)
      .select("id");
    if (error) throw new ConversationsDbError("activation.markActivated", error.code);
    return (data?.length ?? 0) > 0;
  },
};

const UPLOAD_TIMEOUT_MS = 20_000;
const SEND_TIMEOUT_MS = 15_000;

/** Dependencias reales del envío (Meta + base de datos), las mismas que usa el resto de Conversations. */
export function productionSendDeps(): SendDeps {
  return {
    repository: outboundRepository,
    sendText: (input) => sendTextMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    uploadMedia: (input) => uploadMedia(input, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    sendDocument: (input) => sendDocumentMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    sendImage: (input) => sendImageMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    isConfigured: isWhatsAppSenderConfigured,
  };
}

/** Botón manual "Enviar activación" (quien llama ya comprobó super_admin). */
export function sendManualActivation(conversationId: string): Promise<ActivationOutcome> {
  return sendContactActivation(
    { conversationId },
    {
      activations: contactActivationRepository,
      send: productionSendDeps(),
      sendTemplate: (input) => sendTemplateMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    }
  );
}

/**
 * Acción desencadenada por un mensaje entrante ya guardado. Errores de base de datos se
 * propagan (el webhook responde 500 y Meta reentrega: todo es idempotente). Un envío que Meta
 * no acepta NO lanza: se registra con ids técnicos y el contacto puede volver a escribir.
 */
export function runInboundAction(
  message: InboundMessage,
  ingest: { contactId: string; conversationId: string; redelivery: boolean }
): Promise<InboundActionResult> {
  const deps = productionSendDeps();
  return handleInboundAction(
    { message, ...ingest },
    {
      activations: contactActivationRepository,
      async sendReply({ conversationId, requestId, text }) {
        const outcome = await sendConversationOperation({ conversationId, requestId, text }, deps);
        if (outcome.status !== "sent") {
          console.error(`[conversations-action] reply_not_sent status=${outcome.status} conversationId=${conversationId}`);
        }
      },
    }
  );
}
