import "server-only";

import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import { loadCatalog } from "@/lib/auth/user-access.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isUniqueViolation } from "@/lib/supabase/conversations-mappers";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { ConversationsDbError } from "@/lib/supabase/conversations.server";
import { validateContactAccess, type ContactAccessCatalog, type ContactAccessValue } from "@/lib/conversations/contact-access";
import { getContactAccessSelection, resolveContactRestaurantIds } from "@/lib/conversations/contact-scope.server";
import { contactWhatsAppState, type ContactWhatsAppState } from "@/lib/conversations/contact-activation";
import { resolveContactDisplayName } from "@/lib/conversations/read-model";

/**
 * Ficha y permisos de un contacto de WhatsApp. Los permisos (empresa, "todos",
 * restaurantes) se guardan SOLO en las tablas del contacto, con una transacción
 * (`nexo_set_contact_access`), y no se copian de ninguna cuenta web. El vínculo con
 * una cuenta web (`usuario_id`) es opcional e informativo: no da ni quita acceso.
 * Solo super_admin (lo comprueba quien llama).
 */

export class ContactError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 500,
    message: string
  ) {
    super(message);
    this.name = "ContactError";
  }
}

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

export function contactCatalog(catalog: Awaited<ReturnType<typeof loadCatalog>>): ContactAccessCatalog {
  return {
    empresaIds: new Set(catalog.empresas.map((empresa) => Number(empresa.id))),
    restaurants: catalog.restaurantes.map((restaurant) => ({
      id: Number(restaurant.id),
      empresaId: restaurant.empresa_id === null ? null : Number(restaurant.empresa_id),
    })),
  };
}

/** Valida tipo, empresa y restaurantes contra el catálogo (400 si hay restaurantes de otra empresa, etc.). */
export async function assertValidContactAccess(access: unknown): Promise<ContactAccessValue> {
  const validation = validateContactAccess(access, contactCatalog(await loadCatalog()));
  if (!validation.ok) throw new ContactError(400, validation.error);
  return validation.value;
}

/** Guarda nombre, tipo, empresa, "todos" y restaurantes de un contacto en una única transacción SQL. */
export async function saveContactAccess(
  contactoId: string,
  input: { nombre: string | null; access: unknown }
): Promise<void> {
  const value = await assertValidContactAccess(input.access);

  const { error } = await requireAdminClient().rpc("nexo_set_contact_access", {
    p_contacto_id: contactoId,
    p_nombre: input.nombre,
    p_tipo: value.tipo,
    p_empresa_id: value.empresaId,
    p_todos: value.todosRestaurantes,
    p_restaurante_ids: value.restaurantIds,
  });

  if (error) {
    // Solo el SQLSTATE: el mensaje de la base de datos puede incluir valores.
    if (error.code === "22023") throw new ContactError(400, "Selección no válida");
    if (error.code === "P0002") throw new ContactError(404, "Contacto no encontrado");
    throw new ContactError(500, "No se pudo guardar el contacto");
  }
}

async function findContactOfConversation(conversationId: string) {
  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select("contacto_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new ConversationsDbError("contact.findConversation", error.code);
  return (data as { contacto_id: string } | null)?.contacto_id ?? null;
}

export type LinkedUser = { id: string; nombre: string; rol: string; empresaNombre: string | null };

export type ContactDetail = {
  displayName: string;
  phone: string;
  nombre: string | null;
  tipo: string | null;
  /** Lo guardado, para editar. */
  selection: { empresaId: number | null; todosRestaurantes: boolean; restaurantIds: number[] };
  /** Lo que puede consultar HOY (resuelto desde las tablas del contacto). */
  access: { count: number; restaurants: { id: number; name: string; brand: string; city: string }[] };
  /** Cuenta web opcional; solo informativa. */
  linkedUser: LinkedUser | null;
  /** Estado de la activación por WhatsApp (solo informativo: no concede permisos). */
  whatsapp: ContactWhatsAppState;
};

async function empresaNombre(empresaId: string | null): Promise<string | null> {
  if (!empresaId) return null;
  const { data } = await requireAdminClient().from(SUPABASE_TABLES.empresas).select("nombre").eq("id", empresaId).maybeSingle();
  return (data as { nombre: string } | null)?.nombre ?? null;
}

export async function getConversationContactDetail(conversationId: string): Promise<ContactDetail | null> {
  const contactoId = await findContactOfConversation(conversationId);
  if (!contactoId) return null;

  const { data, error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .select("telefono_e164,nombre,nombre_perfil,tipo,usuario_id,welcome_sent_at,whatsapp_activated_at")
    .eq("id", contactoId)
    .maybeSingle();
  if (error) throw new ConversationsDbError("contact.get", error.code);
  if (!data) return null;

  const contact = data as {
    telefono_e164: string;
    nombre: string | null;
    nombre_perfil: string | null;
    tipo: string | null;
    usuario_id: string | null;
    welcome_sent_at: string | null;
    whatsapp_activated_at: string | null;
  };

  const [selection, restaurantIds, catalog, perfil] = await Promise.all([
    getContactAccessSelection(contactoId),
    resolveContactRestaurantIds(contactoId),
    loadCatalog(),
    contact.usuario_id ? fetchPerfilFresh(contact.usuario_id) : Promise.resolve(null),
  ]);

  const allowed = new Set(restaurantIds);
  const brandName = new Map(catalog.marcas.map((marca) => [Number(marca.id), marca.nombre]));
  const restaurants = catalog.restaurantes
    .filter((restaurant) => allowed.has(Number(restaurant.id)))
    .map((restaurant) => ({
      id: Number(restaurant.id),
      name: restaurant.nombre,
      brand: restaurant.marca_id === null ? "" : (brandName.get(Number(restaurant.marca_id)) ?? ""),
      city: restaurant.ciudad ?? "",
    }));

  return {
    displayName: resolveContactDisplayName(contact),
    phone: contact.telefono_e164,
    nombre: contact.nombre,
    tipo: contact.tipo,
    selection,
    access: { count: restaurants.length, restaurants },
    linkedUser: perfil
      ? { id: perfil.id, nombre: perfil.nombre ?? "", rol: perfil.rol, empresaNombre: await empresaNombre(perfil.empresaId) }
      : null,
    whatsapp: contactWhatsAppState({ welcomeSentAt: contact.welcome_sent_at, activatedAt: contact.whatsapp_activated_at }),
  };
}

/** Edita nombre, tipo, empresa, "todos" y restaurantes del contacto de la conversación. */
export async function updateConversationContact(conversationId: string, input: unknown): Promise<ContactDetail> {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  let nombre: string | null = null;
  if (record.nombre !== undefined && record.nombre !== null) {
    if (typeof record.nombre !== "string" || Array.from(record.nombre.trim()).length > 100) {
      throw new ContactError(400, "Nombre no válido");
    }
    nombre = record.nombre.trim() === "" ? null : record.nombre.trim();
  }

  const contactoId = await findContactOfConversation(conversationId);
  if (!contactoId) throw new ContactError(404, "Conversación no encontrada");

  await saveContactAccess(contactoId, { nombre, access: record });

  const detail = await getConversationContactDetail(conversationId);
  if (!detail) throw new ContactError(404, "Conversación no encontrada");
  return detail;
}

export type LinkResult = "ok" | "conversation_not_found" | "user_not_found" | "already_linked";

/** Vincula (o desvincula con `null`) el contacto a una cuenta web. Solo informativo: no cambia permisos. */
export async function setConversationContactUser(conversationId: string, usuarioId: string | null): Promise<LinkResult> {
  const contactoId = await findContactOfConversation(conversationId);
  if (!contactoId) return "conversation_not_found";

  if (usuarioId !== null && !(await fetchPerfilFresh(usuarioId))) return "user_not_found";

  const { error } = await requireAdminClient()
    .from(SUPABASE_TABLES.conv_contactos)
    .update({ usuario_id: usuarioId, updated_at: new Date().toISOString() })
    .eq("id", contactoId);

  if (error) {
    // Una cuenta web = un teléfono (índice único parcial).
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

/** Cuentas web que se pueden vincular a un contacto. */
export async function listLinkableUsers(conversationId: string | null): Promise<LinkableUser[]> {
  const client = requireAdminClient();
  const contactoId = conversationId ? await findContactOfConversation(conversationId) : null;

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
