import "server-only";

import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CONV_CONSTRAINTS, isUniqueViolation } from "@/lib/supabase/conversations-mappers";
import { findOrCreateConversation, ConversationsDbError } from "@/lib/supabase/conversations.server";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

/**
 * Alta manual de contactos de WhatsApp (solo servidor; quien llama ya comprobó
 * super_admin). Reglas:
 *  - Un teléfono = un contacto (`telefono_e164` único): si ya existe se reutiliza,
 *    nunca se duplica y NUNCA se sobrescribe su nombre ni su usuario vinculado.
 *  - Crear un contacto NO da acceso a datos: solo existe acceso si se vincula una
 *    persona de Nexo válida (`usuario_id`); sin vínculo el alcance es vacío.
 *  - No se tocan permisos ni restaurantes: el alcance sigue saliendo de
 *    `fetchUserScope` a través de la persona vinculada.
 *  - Se deja la conversación abierta con el canal central para que el contacto se
 *    vea en la bandeja antes de que escriba (si hay un único canal conectado).
 */

const USUARIO_CONSTRAINT = "conv_contactos_usuario_id_key";
const CONTACT_COLUMNS = "id,telefono_e164,nombre,usuario_id";

type ContactRow = { id: string; telefono_e164: string; nombre: string | null; usuario_id: string | null };

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

export type ManualContactResult =
  | {
      status: "created" | "existing";
      contactId: string;
      /** Conversación de la bandeja para abrirla; `null` si no hay un único canal conectado. */
      conversationId: string | null;
      linked: boolean;
    }
  | { status: "user_not_found" }
  /** El usuario de Nexo ya está vinculado a otro teléfono. */
  | { status: "user_already_linked" }
  /** El teléfono ya pertenece a otra persona de Nexo: no se sobrescribe. */
  | { status: "phone_linked_to_other_user" };

async function selectByPhone(telefonoE164: string): Promise<ContactRow | null> {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .select(CONTACT_COLUMNS)
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

async function linkUser(contactId: string, usuarioId: string): Promise<"ok" | "user_already_linked"> {
  const { error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .update({ usuario_id: usuarioId, updated_at: new Date().toISOString() })
    .eq("id", contactId);
  if (error) {
    if (isUniqueViolation(error, USUARIO_CONSTRAINT)) return "user_already_linked";
    throw new ConversationsDbError("manualContact.link", error.code);
  }
  return "ok";
}

export async function createManualContact(input: {
  nombre: string | null;
  telefonoE164: string;
  usuarioId: string | null;
}): Promise<ManualContactResult> {
  const { nombre, telefonoE164, usuarioId } = input;

  if (usuarioId !== null && !(await fetchPerfilFresh(usuarioId))) return { status: "user_not_found" };

  let existing = await selectByPhone(telefonoE164);

  if (!existing) {
    const { data, error } = await requireAdminClient()
      .from(SUPABASE_TABLES.conv_contactos)
      .insert({
        telefono_e164: telefonoE164,
        ...(nombre ? { nombre } : {}),
        ...(usuarioId ? { usuario_id: usuarioId } : {}),
      })
      .select(CONTACT_COLUMNS)
      .single();

    if (!error) {
      const created = data as ContactRow;
      return {
        status: "created",
        contactId: created.id,
        conversationId: await conversationFor(created.id),
        linked: Boolean(created.usuario_id),
      };
    }
    if (isUniqueViolation(error, USUARIO_CONSTRAINT)) return { status: "user_already_linked" };
    if (!isUniqueViolation(error, CONV_CONSTRAINTS.contactoTelefono)) {
      throw new ConversationsDbError("manualContact.insert", error.code);
    }

    // Otra petición (p. ej. un mensaje entrante) lo creó a la vez: se reutiliza.
    existing = await selectByPhone(telefonoE164);
    if (!existing) throw new Error("conversations.manualContact: contact vanished after conflict");
  }

  // Ya existía: se reutiliza sin duplicar ni sobrescribir nombre ni vínculo.
  const currentUser = existing.usuario_id ?? null;
  let linked = currentUser !== null;
  if (usuarioId !== null) {
    if (currentUser !== null && currentUser !== usuarioId) {
      return { status: "phone_linked_to_other_user" };
    }
    if (currentUser === null) {
      if ((await linkUser(existing.id, usuarioId)) === "user_already_linked") return { status: "user_already_linked" };
      linked = true;
    }
  }

  return {
    status: "existing",
    contactId: existing.id,
    conversationId: await conversationFor(existing.id),
    linked,
  };
}
