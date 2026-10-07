import "server-only";

import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import { canManageUserAccess, validateUserAccess } from "@/lib/auth/user-access";
import { UserAccessError, accessCatalog, admin, loadCatalog } from "@/lib/auth/user-access.server";
import { parseNewUserBody } from "@/lib/auth/user-creation";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

/**
 * Alta de usuarios de Nexo (solo servidor; quien llama ya comprobó super_admin).
 *
 *  1. Se valida TODO antes de crear nada: formulario y acceso (restaurantes y marcas
 *     deben ser de la empresa elegida) contra el catálogo.
 *  2. Se crea la cuenta en Supabase Auth con la service role, confirmada y SIN
 *     contraseña: la persona la elige ella misma con un enlace de un solo uso. La
 *     contraseña nunca la ve ni la teclea nadie más.
 *  3. Se crea su perfil (rol + empresa) y se guardan sus asignaciones con la misma
 *     función transaccional que la edición (`nexo_set_user_access`): usuario_restaurantes
 *     para un supervisor, usuario_marcas para un responsable de marca, ninguna para
 *     un administrador de empresa.
 *  4. Si algún paso falla, la cuenta recién creada se elimina (el perfil y las
 *     asignaciones caen en cascada): no quedan usuarios a medias.
 */

export type CreatedUser = {
  userId: string;
  /** Enlace de un solo uso para fijar la contraseña; `null` si no se pudo generar (se puede regenerar). */
  activationUrl: string | null;
};

/** Enlace seguro de activación/restablecimiento: se verifica en `/auth/confirm` (token_hash). */
export async function buildActivationUrl(email: string, origin: string): Promise<string | null> {
  const { data, error } = await admin().auth.admin.generateLink({ type: "recovery", email });
  const token = data?.properties?.hashed_token;
  if (error || !token) return null;
  return `${origin}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery`;
}

async function rollbackAuthUser(userId: string): Promise<void> {
  // perfiles.id → auth.users ON DELETE CASCADE: el perfil y sus asignaciones se van con ella.
  await admin().auth.admin.deleteUser(userId).catch(() => undefined);
}

export async function createManagedUser(
  actor: { userId: string; rol: string },
  input: unknown,
  origin: string
): Promise<CreatedUser> {
  if (actor.rol !== "super_admin") throw new UserAccessError(403, "No autorizado");

  const parsed = parseNewUserBody(input);
  if (!parsed.ok) throw new UserAccessError(400, parsed.error);

  const catalog = await loadCatalog();
  const access = validateUserAccess(
    { rol: parsed.rol, empresaId: parsed.empresaId, restaurantIds: parsed.restaurantIds, marcaIds: parsed.marcaIds },
    accessCatalog(catalog)
  );
  if (!access.ok) throw new UserAccessError(400, access.error);
  const { value } = access;

  const client = admin();

  // Email repetido: ya hay un perfil con ese email (Auth lo vuelve a comprobar al crear).
  const { data: duplicate, error: duplicateError } = await client
    .from(SUPABASE_TABLES.perfiles)
    .select("id")
    .eq("email", parsed.email)
    .maybeSingle();
  if (duplicateError) throw new UserAccessError(500, "No se pudo crear el usuario");
  if (duplicate) throw new UserAccessError(409, "Ya existe un usuario con ese email");

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email: parsed.email,
    email_confirm: true,
    user_metadata: { nombre: parsed.nombre },
  });
  if (createError || !created?.user) {
    const exists = createError?.code === "email_exists" || createError?.status === 422;
    throw new UserAccessError(exists ? 409 : 500, exists ? "Ya existe un usuario con ese email" : "No se pudo crear el usuario");
  }
  const userId = created.user.id;

  const { error: perfilError } = await client.from(SUPABASE_TABLES.perfiles).insert({
    id: userId,
    nombre: parsed.nombre,
    email: parsed.email,
    rol: value.rol,
    empresa_id: value.empresaId,
  });
  if (perfilError) {
    await rollbackAuthUser(userId);
    throw new UserAccessError(500, "No se pudo crear el usuario");
  }

  const { error: accessError } = await client.rpc("nexo_set_user_access", {
    p_user_id: userId,
    p_rol: value.rol,
    p_empresa_id: value.empresaId,
    p_restaurante_ids: value.restaurantIds,
    p_marca_ids: value.marcaIds,
  });
  if (accessError) {
    await rollbackAuthUser(userId);
    // Solo el SQLSTATE: el mensaje de la base de datos puede incluir valores.
    throw new UserAccessError(accessError.code === "22023" ? 400 : 500, accessError.code === "22023" ? "Selección no válida" : "No se pudo guardar el acceso");
  }

  return { userId, activationUrl: await buildActivationUrl(parsed.email, origin) };
}

/**
 * Nuevo enlace de un solo uso para fijar o restablecer la contraseña de un usuario
 * existente (el primero caduca). Nunca de uno mismo ni de un super_admin.
 */
export async function createActivationLink(
  actor: { userId: string; rol: string },
  targetUserId: string,
  origin: string
): Promise<string> {
  const target = await fetchPerfilFresh(targetUserId);
  if (!target) throw new UserAccessError(404, "Usuario no encontrado");

  const decision = canManageUserAccess(actor, { userId: target.id, rol: target.rol });
  if (!decision.ok) throw new UserAccessError(403, decision.error);
  if (!target.email) throw new UserAccessError(400, "El usuario no tiene email");

  const url = await buildActivationUrl(target.email, origin);
  if (!url) throw new UserAccessError(500, "No se pudo generar el enlace");
  return url;
}
