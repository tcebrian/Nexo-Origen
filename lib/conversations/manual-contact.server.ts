import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CONV_CONSTRAINTS, isUniqueViolation } from "@/lib/supabase/conversations-mappers";
import { findOrCreateConversation, ConversationsDbError } from "@/lib/supabase/conversations.server";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { ContactError, assertValidContactAccess, saveContactAccess } from "@/lib/conversations/contact-link.server";

/**
 * Alta manual de contactos de WhatsApp (solo servidor; quien llama ya comprobó
 * super_admin). Reglas:
 *  - Un teléfono = un contacto (`telefono_e164` único): si ya existe se reutiliza,
 *    nunca se duplica y NO se modifica (ni nombre ni permisos): se edita desde su ficha.
 *  - Los permisos del contacto (empresa, "todos", restaurantes) se eligen aquí mismo y
 *    se guardan en sus propias tablas; NO hace falta ninguna cuenta web.
 *  - Sin empresa ni restaurantes, el contacto no tiene acceso a datos (deny by default).
 *  - Se deja la conversación abierta con el canal central para que el contacto se vea
 *    en la bandeja antes de que escriba (si hay un único canal conectado).
 */

type ContactRow = { id: string };

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

export type ManualContactResult = {
  status: "created" | "existing";
  contactId: string;
  /** Conversación de la bandeja para abrirla; `null` si no hay un único canal conectado. */
  conversationId: string | null;
};

async function selectByPhone(telefonoE164: string): Promise<ContactRow | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .select("id")
    .eq("telefono_e164", telefonoE164)
    .maybeSingle();
  if (error) throw new ConversationsDbError("manualContact.select", error.code);
  return (data as ContactRow | null) ?? null;
}

/** El canal central, si hay exactamente uno conectado (si no, no se abre conversación). */
async function singleConnectedChannelId(): Promise<string | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_canales)
    .select("id")
    .eq("provider", "whatsapp_cloud")
    .eq("status", "connected");
  if (error) throw new ConversationsDbError("manualContact.channel", error.code);
  const rows = (data ?? []) as { id: string }[];
  return rows.length === 1 ? rows[0]!.id : null;
}

async function conversationFor(contactId: string): Promise<string | null> {
  const canalId = await singleConnectedChannelId();
  if (!canalId) return null;
  const { conversation } = await findOrCreateConversation({ canalId, contactoId: contactId });
  return conversation.id;
}

export async function createManualContact(input: {
  nombre: string | null;
  telefonoE164: string;
  /** tipo, empresaId, todosRestaurantes y restaurantIds sin validar (se validan aquí). */
  access: Record<string, unknown>;
}): Promise<ManualContactResult> {
  const { nombre, telefonoE164, access } = input;

  // Antes de crear nada: restaurantes de otra empresa, tipo inválido… → 400 sin tocar la base de datos.
  await assertValidContactAccess(access);

  let existing = await selectByPhone(telefonoE164);
  if (existing) {
    return { status: "existing", contactId: existing.id, conversationId: await conversationFor(existing.id) };
  }

  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .insert({ telefono_e164: telefonoE164 })
    .select("id")
    .single();

  if (error) {
    if (!isUniqueViolation(error, CONV_CONSTRAINTS.contactoTelefono)) {
      throw new ConversationsDbError("manualContact.insert", error.code);
    }
    // Otra petición (p. ej. un mensaje entrante) lo creó a la vez: se reutiliza sin tocarlo.
    existing = await selectByPhone(telefonoE164);
    if (!existing) throw new Error("conversations.manualContact: contact vanished after conflict");
    return { status: "existing", contactId: existing.id, conversationId: await conversationFor(existing.id) };
  }

  const contactId = (data as ContactRow).id;

  try {
    // Nombre, tipo, empresa, "todos" y restaurantes: validados y guardados en una transacción.
    await saveContactAccess(contactId, { nombre, access });
  } catch (cause) {
    // El contacto recién creado no tiene nada más: se retira para no dejar uno sin su selección.
    await requireAdminClient().from(SUPABASE_TABLES.conv_contactos).delete().eq("id", contactId);
    throw cause instanceof ContactError ? cause : new ContactError(500, "No se pudo crear el contacto");
  }

  return { status: "created", contactId, conversationId: await conversationFor(contactId) };
}
