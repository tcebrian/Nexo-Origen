import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import {
  CONV_CONSTRAINTS,
  buildContactPatch,
  buildInboundMessageRow,
  classifyMessageInsertError,
  isUniqueViolation,
  lastMessageGuardFilter,
  mapChannelRow,
  mapContactRow,
  mapConversationRow,
  type ChannelRow,
  type Contact,
  type ContactRow,
  type Conversation,
  type ConversationChannel,
  type ConversationRow,
} from "@/lib/supabase/conversations-mappers";
import type { InboundConversationRepository } from "@/lib/conversations/ingest-inbound";
import type { ChannelProvider, InboundMessage } from "@/lib/conversations/types";

/**
 * Persistencia de Nexo Conversations (solo servidor, service role).
 *
 * Operaciones sueltas; la orquestación del flujo entrante es otra capa.
 * Modelo de canal central: el canal y el contacto son globales (sin empresa).
 * Aquí no se resuelve ni se crea ningún permiso: la pertenencia de una persona a
 * empresas y restaurantes vive en `conv_contacto_empresas` /
 * `conv_contacto_restaurantes` (DENY BY DEFAULT: sin filas, acceso cero).
 * Los errores inesperados de base de datos se lanzan (el llamador responderá
 * con un fallo reintentable); lo esperable se devuelve como resultado.
 */

const CHANNEL_COLUMNS = "id,provider,external_account_id,waba_id,display_phone,status";
const CONTACT_COLUMNS = "id,telefono_e164,nombre,nombre_perfil,external_contact_id";
const CONVERSATION_COLUMNS =
  "id,canal_id,contacto_id,estado,ultimo_mensaje_at,ultimo_mensaje_preview";

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

/**
 * Error técnico de base de datos. Lleva la operación y el código SQLSTATE como
 * campos y NO copia el mensaje de PostgreSQL, que puede incluir valores de
 * filas (teléfonos, ids externos…): quien lo registre no debe filtrarlos.
 */
export class ConversationsDbError extends Error {
  constructor(
    readonly operation: string,
    readonly code: string | undefined
  ) {
    super(`conversations.${operation} failed (${code ?? "no-code"})`);
    this.name = "ConversationsDbError";
  }
}

function dbFailure(operation: string, error: { code?: string }): ConversationsDbError {
  return new ConversationsDbError(operation, error.code);
}

// 1) Canal ----------------------------------------------------------------------

export type ResolveChannelResult =
  | { status: "found"; channel: ConversationChannel }
  /** Existe pero no está `connected`: no debe procesar mensajes. */
  | { status: "inactive"; channel: ConversationChannel }
  | { status: "not_found" };

/** Busca el canal por proveedor + cuenta externa (p. ej. whatsapp_cloud + phone_number_id). */
export async function resolveChannel(
  provider: ChannelProvider,
  externalAccountId: string
): Promise<ResolveChannelResult> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_canales)
    .select(CHANNEL_COLUMNS)
    .eq("provider", provider)
    .eq("external_account_id", externalAccountId)
    .maybeSingle();

  if (error) throw dbFailure("resolveChannel", error);
  if (!data) return { status: "not_found" };

  const channel = mapChannelRow(data as ChannelRow);
  return channel.status === "connected"
    ? { status: "found", channel }
    : { status: "inactive", channel };
}

// 2) Contacto -------------------------------------------------------------------

async function selectContact(telefonoE164: string): Promise<ContactRow | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .select(CONTACT_COLUMNS)
    .eq("telefono_e164", telefonoE164)
    .maybeSingle();

  if (error) throw dbFailure("selectContact", error);
  return (data as ContactRow | null) ?? null;
}

export type FindOrCreateContactInput = {
  telefonoE164: string;
  profileName?: string | null;
  externalContactId?: string | null;
};

/**
 * Encuentra el contacto por teléfono (global) o lo crea, SIN empresas ni
 * restaurantes. Con un contacto existente solo actualiza `nombre_perfil` y
 * `external_contact_id` si llega un valor nuevo; `nombre` (editable por Nexo) y
 * los permisos no se tocan nunca.
 * Dos peticiones simultáneas no duplican: la restricción única decide y la
 * perdedora relee el contacto.
 */
export async function findOrCreateContact(
  input: FindOrCreateContactInput
): Promise<{ contact: Contact; created: boolean }> {
  const client = requireAdminClient();
  const { telefonoE164 } = input;

  let row = await selectContact(telefonoE164);
  if (!row) {
    const profileName = input.profileName?.trim();
    const externalContactId = input.externalContactId?.trim();
    const { data, error } = await client
      .from(SUPABASE_TABLES.conv_contactos)
      .insert({
        telefono_e164: telefonoE164,
        ...(profileName ? { nombre_perfil: profileName } : {}),
        ...(externalContactId ? { external_contact_id: externalContactId } : {}),
      })
      .select(CONTACT_COLUMNS)
      .single();

    if (!error) return { contact: mapContactRow(data as ContactRow), created: true };
    if (!isUniqueViolation(error, CONV_CONSTRAINTS.contactoTelefono)) {
      throw dbFailure("findOrCreateContact.insert", error);
    }

    // Otra petición lo creó a la vez: se reutiliza.
    row = await selectContact(telefonoE164);
    if (!row) throw new Error("conversations.findOrCreateContact: contact vanished after conflict");
  }

  const existing = mapContactRow(row);
  const patch = buildContactPatch(existing, {
    profileName: input.profileName,
    externalContactId: input.externalContactId,
  });
  if (!patch) return { contact: existing, created: false };

  const { data, error } = await client
    .from(SUPABASE_TABLES.conv_contactos)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select(CONTACT_COLUMNS)
    .single();

  if (error) throw dbFailure("findOrCreateContact.update", error);
  return { contact: mapContactRow(data as ContactRow), created: false };
}

// 3) Conversación ---------------------------------------------------------------

async function selectConversation(
  canalId: string,
  contactoId: string
): Promise<ConversationRow | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select(CONVERSATION_COLUMNS)
    .eq("canal_id", canalId)
    .eq("contacto_id", contactoId)
    .maybeSingle();

  if (error) throw dbFailure("selectConversation", error);
  return (data as ConversationRow | null) ?? null;
}

export type FindOrCreateConversationInput = {
  canalId: string;
  contactoId: string;
};

/**
 * Encuentra la conversación por canal + contacto o la crea en estado `open`.
 * Una conversación existente se reutiliza tal cual (no se reabre aquí).
 */
export async function findOrCreateConversation(
  input: FindOrCreateConversationInput
): Promise<{ conversation: Conversation; created: boolean }> {
  const { canalId, contactoId } = input;

  const existing = await selectConversation(canalId, contactoId);
  if (existing) return { conversation: mapConversationRow(existing), created: false };

  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .insert({ canal_id: canalId, contacto_id: contactoId })
    .select(CONVERSATION_COLUMNS)
    .single();

  if (!error) return { conversation: mapConversationRow(data as ConversationRow), created: true };
  if (!isUniqueViolation(error, CONV_CONSTRAINTS.conversacionCanalContacto)) {
    throw dbFailure("findOrCreateConversation.insert", error);
  }

  const raced = await selectConversation(canalId, contactoId);
  if (!raced) throw new Error("conversations.findOrCreateConversation: conversation vanished after conflict");
  return { conversation: mapConversationRow(raced), created: false };
}

// 4) Mensaje entrante -----------------------------------------------------------

export type InsertInboundMessageResult = { status: "inserted" } | { status: "duplicate" };

/**
 * Guarda un mensaje entrante. La idempotencia descansa en la restricción única
 * (canal_id, external_id) de PostgreSQL, no en consultar antes: dos webhooks
 * simultáneos no pueden crear dos filas. Un duplicado es un resultado normal.
 * La clave compuesta (conversacion_id, canal_id) impide un mensaje de otro canal.
 * `raw_payload` no se persiste (queda NULL) hasta definir su retención.
 */
export async function insertInboundMessage(input: {
  message: InboundMessage;
  canalId: string;
  conversacionId: string;
}): Promise<InsertInboundMessageResult> {
  const { error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_mensajes)
    .insert(buildInboundMessageRow(input));

  const outcome = classifyMessageInsertError(error);
  if (outcome.status === "error") throw dbFailure("insertInboundMessage", error!);
  return outcome;
}

// 5) Último mensaje de la conversación ------------------------------------------

/**
 * Avanza `ultimo_mensaje_*` solo si el mensaje es estrictamente más reciente
 * (por `provider_timestamp`) y la conversación es del canal indicado. Es un
 * único UPDATE condicional, así que una llegada tardía o una carrera entre dos
 * mensajes no puede hacer retroceder la conversación. Es idempotente: se puede
 * llamar también tras un duplicado para reparar un fallo anterior entre el
 * insert del mensaje y esta actualización. Devuelve `true` si avanzó.
 */
export async function touchConversationLastMessage(input: {
  conversacionId: string;
  canalId: string;
  lastMessageAt: Date;
  preview: string;
}): Promise<boolean> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .update({
      ultimo_mensaje_at: input.lastMessageAt.toISOString(),
      ultimo_mensaje_preview: input.preview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversacionId)
    .eq("canal_id", input.canalId)
    .or(lastMessageGuardFilter(input.lastMessageAt))
    .select("id");

  if (error) throw dbFailure("touchConversationLastMessage", error);
  return (data?.length ?? 0) > 0;
}

/**
 * Repositorio listo para inyectar en `ingestInboundMessage`.
 * `satisfies` hace que el compilador compruebe que las firmas encajan.
 */
export const conversationsRepository = {
  resolveChannel,
  findOrCreateContact,
  findOrCreateConversation,
  insertInboundMessage,
  touchConversationLastMessage,
} satisfies InboundConversationRepository;
