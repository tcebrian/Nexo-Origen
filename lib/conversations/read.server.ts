import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { ConversationsDbError } from "@/lib/supabase/conversations.server";
import { resolveContactsRestaurantIds } from "@/lib/conversations/contact-scope.server";
import {
  buildConversationList,
  contactOf,
  buildMessageList,
  type ConversationListItem,
  type ConversationMessage,
  type ConversationReadRow,
  type MessageReadRow,
} from "@/lib/conversations/read-model";

/**
 * Lectura de Nexo Conversations para la interfaz (solo servidor, service role).
 * No comprueba permisos: quien llama (página o route handler) debe haber
 * autorizado antes con `authorizeConversationsAccess`.
 * Selecciona columnas explícitas: `raw_payload` y los IDs externos no se leen.
 */

/** Límites por defecto; punto de partida para añadir paginación por cursor. */
export const CONVERSATIONS_PAGE_SIZE = 200;
export const MESSAGES_PAGE_SIZE = 500;

const CONVERSATION_SELECT =
  "id,estado,ultimo_mensaje_at,ultimo_mensaje_preview,conv_contactos(id,telefono_e164,nombre,nombre_perfil,tipo)";
const MESSAGE_SELECT =
  "id,direction,sender_type,content_type,text,media,status,provider_timestamp,received_at";

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

export async function listConversations(
  limit: number = CONVERSATIONS_PAGE_SIZE
): Promise<ConversationListItem[]> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select(CONVERSATION_SELECT)
    .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new ConversationsDbError("listConversations", error.code);

  const rows = (data ?? []) as unknown as ConversationReadRow[];
  const items = buildConversationList(rows);

  // Distintivo de acceso: con permisos propios del contacto (nº de restaurantes de hoy) o sin acceso a datos.
  const contactByConversation = new Map(rows.map((row) => [row.id, contactOf(row)]));
  const contactIds = [...new Set([...contactByConversation.values()].map((c) => c.id).filter((id): id is string => id !== null))];
  const restaurantIdsByContact = await resolveContactsRestaurantIds(contactIds);

  return items.map((item) => {
    const contact = contactByConversation.get(item.id);
    const count = contact?.id ? (restaurantIdsByContact.get(contact.id)?.length ?? 0) : 0;
    return count > 0 ? { ...item, access: { state: "granted" as const, restaurantCount: count, tipo: contact?.tipo ?? null } } : item;
  });
}

/**
 * Mensajes de una conversación en orden cronológico. Pide los más recientes
 * (hasta `limit`) y los devuelve ascendentes; `null` si la conversación no existe.
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = MESSAGES_PAGE_SIZE
): Promise<ConversationMessage[] | null> {
  const client = requireAdminClient();

  const { data: conversation, error: conversationError } = await client
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    throw new ConversationsDbError("getConversationMessages.conversation", conversationError.code);
  }
  if (!conversation) return null;

  const { data, error } = await client
    .from(SUPABASE_TABLES.conv_mensajes)
    .select(MESSAGE_SELECT)
    .eq("conversacion_id", conversationId)
    .order("provider_timestamp", { ascending: false })
    .limit(limit);

  if (error) throw new ConversationsDbError("getConversationMessages.messages", error.code);
  return buildMessageList((data ?? []) as unknown as MessageReadRow[]);
}
