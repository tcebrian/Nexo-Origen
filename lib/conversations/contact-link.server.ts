import "server-only";

import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import { effectiveAccessFor, type EffectiveAccess } from "@/lib/auth/user-access.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isUniqueViolation } from "@/lib/supabase/conversations-mappers";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { ConversationsDbError } from "@/lib/supabase/conversations.server";
import { resolveContactDisplayName } from "@/lib/conversations/read-model";

/**
 * Vínculo contacto de WhatsApp ↔ persona de Nexo (`conv_contactos.usuario_id`) y
 * resumen de su acceso. Aquí NO se editan restaurantes ni permisos: eso se hace
 * solo en la gestión central de usuarios. Solo super_admin (lo comprueba quien llama).
 */

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

export type LinkedUser = { id: string; nombre: string; rol: string; empresaNombre: string | null };

export type ContactAccessSummary = {
  displayName: string;
  phone: string;
  linkedUser: LinkedUser | null;
  /** Sin usuario vinculado: 0 restaurantes (deny by default). */
  access: EffectiveAccess;
};

async function findContactOfConversation(conversationId: string) {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select("contacto_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new ConversationsDbError("contact.findConversation", error.code);
  return (data as { contacto_id: string } | null)?.contacto_id ?? null;
}

async function empresaNombre(empresaId: string | null): Promise<string | null> {
  if (!empresaId) return null;
  const { data } = await requireAdminClient().from(SUPABASE_TABLES.empresas).select("nombre").eq("id", empresaId).maybeSingle();
  return (data as { nombre: string } | null)?.nombre ?? null;
}

/** Contacto de la conversación con su usuario vinculado y su acceso efectivo de HOY. */
export async function getConversationContactAccess(conversationId: string): Promise<ContactAccessSummary | null> {
  const contactoId = await findContactOfConversation(conversationId);
  if (!contactoId) return null;

  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .select("telefono_e164,nombre,nombre_perfil,usuario_id")
    .eq("id", contactoId)
    .maybeSingle();
  if (error) throw new ConversationsDbError("contact.get", error.code);
  if (!data) return null;

  const contact = data as { telefono_e164: string; nombre: string | null; nombre_perfil: string | null; usuario_id: string | null };
  const base = {
    displayName: resolveContactDisplayName(contact),
    phone: contact.telefono_e164,
  };

  const perfil = contact.usuario_id ? await fetchPerfilFresh(contact.usuario_id) : null;
  if (!perfil) return { ...base, linkedUser: null, access: { count: 0, restaurants: [] } };

  return {
    ...base,
    linkedUser: {
      id: perfil.id,
      nombre: perfil.nombre ?? "",
      rol: perfil.rol,
      empresaNombre: await empresaNombre(perfil.empresaId),
    },
    access: await effectiveAccessFor(perfil),
  };
}

export type LinkResult = "ok" | "conversation_not_found" | "user_not_found" | "already_linked";

/** Vincula (o desvincula con `null`) el contacto de la conversación a una persona de Nexo. */
export async function setConversationContactUser(conversationId: string, usuarioId: string | null): Promise<LinkResult> {
  const contactoId = await findContactOfConversation(conversationId);
  if (!contactoId) return "conversation_not_found";

  if (usuarioId !== null && !(await fetchPerfilFresh(usuarioId))) return "user_not_found";

  const { error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .update({ usuario_id: usuarioId, updated_at: new Date().toISOString() })
    .eq("id", contactoId);

  if (error) {
    // Un usuario de Nexo = un teléfono (índice único parcial).
    if (isUniqueViolation(error, "conv_contactos_usuario_id_key")) return "already_linked";
    throw new ConversationsDbError("contact.link", error.code);
  }
  return "ok";
}

export type LinkableUser = {
  id: string;
  nombre: string;
  rol: string;
  empresaNombre: string | null;
  /** Ya vinculado a OTRO teléfono: no se puede vincular a este. */
  linkedElsewhere: boolean;
};

/** Personas de Nexo que se pueden vincular a un contacto. */
export async function listLinkableUsers(conversationId: string): Promise<LinkableUser[]> {
  const client = requireAdminClient();
  const contactoId = await findContactOfConversation(conversationId);

  const [perfiles, empresas, linked] = await Promise.all([
    client.from(SUPABASE_TABLES.perfiles).select("id,nombre,rol,empresa_id").order("nombre"),
    client.from(SUPABASE_TABLES.empresas).select("id,nombre"),
    client.from(SUPABASE_TABLES.conv_contactos).select("id,usuario_id").not("usuario_id", "is", null),
  ]);
  if (perfiles.error) throw new ConversationsDbError("contact.users", perfiles.error.code);

  const empresaName = new Map((empresas.data ?? []).map((row) => [String((row as { id: number }).id), (row as { nombre: string }).nombre]));
  const linkedTo = new Map((linked.data ?? []).map((row) => [(row as { usuario_id: string }).usuario_id, (row as { id: string }).id]));

  return (perfiles.data ?? []).map((row) => {
    const perfil = row as { id: string; nombre: string; rol: string; empresa_id: number | null };
    const owner = linkedTo.get(perfil.id);
    return {
      id: perfil.id,
      nombre: perfil.nombre,
      rol: perfil.rol,
      empresaNombre: perfil.empresa_id === null ? null : (empresaName.get(String(perfil.empresa_id)) ?? null),
      linkedElsewhere: owner !== undefined && owner !== contactoId,
    };
  });
}
