import "server-only";

import { fetchPerfilFresh, invalidatePerfilCache } from "@/lib/auth/perfiles";
import { canManageUserAccess, validateUserAccess } from "@/lib/auth/user-access";
import { UserAccessError, accessCatalog, admin, loadCatalog } from "@/lib/auth/user-access.server";
import { parseNewUserBody, validatePasswordValue } from "@/lib/auth/user-creation";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

/**
 * Altas y contraseñas de usuarios de Nexo (solo servidor).
 *
 * La contraseña INICIAL la fija el super_admin y solo viaja de aquí a Supabase Auth
 * (Admin API, service role). Nunca se guarda en `perfiles` ni en ninguna otra tabla,
 * no se devuelve en ninguna respuesta, no se registra y no se copia a metadatos. Lo único
 * que se persiste es `perfiles.must_change_password` (un boolean): si es true, la persona
 * debe cambiarla en su primer acceso.
 *
 * Alta:
 *  1. Se valida TODO antes de crear nada: formulario, contraseña y acceso (restaurantes y
 *     marcas deben ser de la empresa elegida) contra el catálogo.
 *  2. Se crea la cuenta en Supabase Auth con email + contraseña, ya confirmada.
 *  3. Se crea su perfil (rol, empresa y `must_change_password`) y se guardan sus
 *     asignaciones con la función transaccional de siempre (`nexo_set_user_access`).
 *  4. Si algún paso falla, la cuenta recién creada se elimina (el perfil y las asignaciones
 *     caen en cascada): no quedan usuarios a medias.
 */

export type CreatedUser = { userId: string };

/** Si la persona debe cambiar la contraseña antes de usar Nexo (por defecto sí). */
async function setMustChangePassword(userId: string, value: boolean): Promise<void> {
  const { error } = await admin().from(SUPABASE_TABLES.perfiles).update({ must_change_password: value }).eq("id", userId);
  if (error) throw new UserAccessError(500, "No se pudo guardar la contraseña");
  invalidatePerfilCache(userId);
}

/** Fija la contraseña de una cuenta en Supabase Auth. Nada de ella sale de esta función. */
async function setAuthPassword(userId: string, password: string): Promise<void> {
  const { error } = await admin().auth.admin.updateUserById(userId, { password });
  if (error) {
    // Supabase puede rechazar contraseñas débiles o filtradas: mensaje genérico, sin copiar el suyo.
    throw new UserAccessError(error.status === 422 ? 400 : 500, error.status === 422 ? "Supabase ha rechazado la contraseña. Elige otra más segura." : "No se pudo guardar la contraseña");
  }
}

async function rollbackAuthUser(userId: string): Promise<void> {
  // perfiles.id → auth.users ON DELETE CASCADE: el perfil y sus asignaciones se van con ella.
  await admin().auth.admin.deleteUser(userId).catch(() => undefined);
}

export async function createManagedUser(actor: { userId: string; rol: string }, input: unknown): Promise<CreatedUser> {
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
    password: parsed.password,
    email_confirm: true,
    user_metadata: { nombre: parsed.nombre },
  });
  if (createError || !created?.user) {
    const exists = createError?.code === "email_exists";
    const weak = createError?.code === "weak_password";
    throw new UserAccessError(
      exists ? 409 : weak ? 400 : 500,
      exists
        ? "Ya existe un usuario con ese email"
        : weak
          ? "Supabase ha rechazado la contraseña. Elige otra más segura."
          : "No se pudo crear el usuario"
    );
  }
  const userId = created.user.id;

  const { error: perfilError } = await client.from(SUPABASE_TABLES.perfiles).insert({
    id: userId,
    nombre: parsed.nombre,
    email: parsed.email,
    rol: value.rol,
    empresa_id: value.empresaId,
    must_change_password: parsed.mustChangePassword,
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

  return { userId };
}

/**
 * Un super_admin fija una contraseña nueva a una cuenta existente (la actual no se puede
 * ver: Supabase no la expone). Nunca la suya ni la de otro super_admin.
 */
export async function setManagedUserPassword(
  actor: { userId: string; rol: string },
  targetUserId: string,
  input: unknown
): Promise<void> {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const target = await fetchPerfilFresh(targetUserId);
  if (!target) throw new UserAccessError(404, "Usuario no encontrado");

  const decision = canManageUserAccess(actor, { userId: target.id, rol: target.rol });
  if (!decision.ok) throw new UserAccessError(403, decision.error);

  const check = validatePasswordValue(record.password);
  if (!check.ok) throw new UserAccessError(400, check.error);
  if (record.mustChangePassword !== undefined && typeof record.mustChangePassword !== "boolean") {
    throw new UserAccessError(400, "Opción de cambio de contraseña no válida");
  }

  await setAuthPassword(target.id, record.password as string);
  await setMustChangePassword(target.id, record.mustChangePassword !== false);
}

/**
 * La propia persona elige su contraseña (cambio obligatorio, voluntario o tras recuperarla).
 * Solo se baja `must_change_password` DESPUÉS de que Supabase Auth haya guardado la nueva.
 */
export async function changeOwnPassword(userId: string, password: unknown): Promise<void> {
  const check = validatePasswordValue(password);
  if (!check.ok) throw new UserAccessError(400, check.error);

  await setAuthPassword(userId, password as string);
  await setMustChangePassword(userId, false);
}
