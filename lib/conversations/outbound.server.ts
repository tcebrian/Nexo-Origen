import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import {
  ConversationsDbError,
  touchConversationLastMessage,
} from "@/lib/supabase/conversations.server";
import { isUniqueViolation } from "@/lib/supabase/conversations-mappers";
import type {
  ClaimResult,
  OutboundRecord,
  OutboundRepository,
  SendContext,
} from "@/lib/conversations/send-text";

/**
 * Persistencia del envío saliente (solo servidor, service role).
 * Implementa `OutboundRepository`; la orquestación vive en `send-text.ts`.
 * No guarda `raw_payload` (queda NULL). Los errores de base de datos se lanzan
 * como `ConversationsDbError` (solo operación + SQLSTATE, sin valores de filas).
 */

const CLIENT_REQUEST_ID_CONSTRAINT = "conv_mensajes_client_request_id_key";

const MESSAGE_COLUMNS =
  "id,conversacion_id,external_id,direction,sender_type,content_type,text,media,status,provider_timestamp,received_at";

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

async function loadContext(conversationId: string): Promise<SendContext | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select(
      "id,conv_contactos(telefono_e164),conv_canales(id,provider,external_account_id,status)"
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw new ConversationsDbError("outbound.loadContext", error.code);
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    conv_contactos: { telefono_e164: string } | { telefono_e164: string }[] | null;
    conv_canales:
      | { id: string; provider: string; external_account_id: string; status: string }
      | { id: string; provider: string; external_account_id: string; status: string }[]
      | null;
  };
  const contact = one(row.conv_contactos);
  const canal = one(row.conv_canales);
  if (!contact || !canal) return null;

  return {
    conversationId: row.id,
    canal: {
      id: canal.id,
      provider: canal.provider,
      externalAccountId: canal.external_account_id,
      status: canal.status,
    },
    contactPhone: contact.telefono_e164,
  };
}

async function selectByRequestId(requestId: string): Promise<OutboundRecord | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_mensajes)
    .select(MESSAGE_COLUMNS)
    .eq("client_request_id", requestId)
    .maybeSingle();

  if (error) throw new ConversationsDbError("outbound.selectByRequestId", error.code);
  return (data as OutboundRecord | null) ?? null;
}

/**
 * Reserva el saliente. La restricción única de `client_request_id` decide: si dos
 * peticiones con el mismo id llegan a la vez, solo una inserta y la otra relee.
 */
async function claim(input: {
  conversationId: string;
  canalId: string;
  requestId: string;
  text: string;
  now: Date;
}): Promise<ClaimResult> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_mensajes)
    .insert({
      conversacion_id: input.conversationId,
      canal_id: input.canalId,
      direction: "outbound",
      sender_type: "human",
      content_type: "text",
      text: input.text,
      status: "pending",
      provider_timestamp: input.now.toISOString(),
      client_request_id: input.requestId,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (!error) return { status: "claimed", message: data as OutboundRecord };
  if (!isUniqueViolation(error, CLIENT_REQUEST_ID_CONSTRAINT)) {
    throw new ConversationsDbError("outbound.claim", error.code);
  }

  const existing = await selectByRequestId(input.requestId);
  if (!existing) throw new Error("conversations.outbound.claim: message vanished after conflict");
  return { status: "existing", message: existing };
}

async function reclaimFailed(messageId: string): Promise<boolean> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_mensajes)
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("status", "failed")
    .select("id");

  if (error) throw new ConversationsDbError("outbound.reclaimFailed", error.code);
  return (data?.length ?? 0) > 0;
}

async function markSent(input: {
  messageId: string;
  wamid: string;
  sentAt: Date;
}): Promise<OutboundRecord> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_mensajes)
    .update({
      status: "sent",
      external_id: input.wamid,
      provider_timestamp: input.sentAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.messageId)
    .eq("status", "pending")
    .select(MESSAGE_COLUMNS)
    .maybeSingle();

  if (error) throw new ConversationsDbError("outbound.markSent", error.code);
  if (!data) throw new ConversationsDbError("outbound.markSent.notPending", undefined);
  return data as OutboundRecord;
}

async function markFailed(messageId: string): Promise<void> {
  const { error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_mensajes)
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("status", "pending");

  if (error) throw new ConversationsDbError("outbound.markFailed", error.code);
}

async function touchConversation(input: {
  conversationId: string;
  canalId: string;
  at: Date;
  preview: string;
}): Promise<boolean> {
  return touchConversationLastMessage({
    conversacionId: input.conversationId,
    canalId: input.canalId,
    lastMessageAt: input.at,
    preview: input.preview,
  });
}

export const outboundRepository: OutboundRepository = {
  loadContext,
  claim,
  reclaimFailed,
  markSent,
  markFailed,
  touchConversation,
};
