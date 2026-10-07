/**
 * Reglas (puras) para gestionar el acceso de una persona desde la web de Nexo.
 * Aquí NO se calcula qué ve cada persona (eso es `fetchUserScope`, única fuente de
 * verdad): solo se valida lo que se guarda en perfiles / usuario_marcas /
 * usuario_restaurantes antes de pasarlo a `nexo_set_user_access`, que lo vuelve a
 * validar en la base de datos.
 *
 * Modelo (el alcance siempre depende del rol ACTUAL):
 *  - empresa_admin    → todos los restaurantes de su empresa (sin asignaciones).
 *  - marca_admin      → todos los restaurantes de sus marcas (usuario_marcas).
 *  - restaurante_user → los restaurantes de usuario_restaurantes (varios: supervisores).
 *  - super_admin      → no se gestiona desde aquí.
 */

export const MANAGEABLE_ROLES = ["empresa_admin", "marca_admin", "restaurante_user"] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export function isManageableRole(value: unknown): value is ManageableRole {
  return (MANAGEABLE_ROLES as readonly unknown[]).includes(value);
}

export type AccessCatalog = {
  empresaIds: ReadonlySet<number>;
  restaurants: readonly { id: number; empresaId: number | null; marcaId: number | null }[];
};

export type UserAccessValue = {
  rol: ManageableRole;
  empresaId: number;
  /** Solo para restaurante_user; vacío en cualquier otro rol. */
  restaurantIds: number[];
  /** Solo para marca_admin; vacío en cualquier otro rol. */
  marcaIds: number[];
};

export type UserAccessValidation = { ok: true; value: UserAccessValue } | { ok: false; error: string };

function positiveIntList(value: unknown): number[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item <= 0) return null;
    ids.push(item);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Valida y normaliza la selección final de acceso. DENY ante cualquier
 * inconsistencia: restaurantes o marcas de otra empresa, ids inexistentes, rol
 * no gestionable. Las listas que el rol no usa se descartan (nunca se guardan).
 */
export function validateUserAccess(input: unknown, catalog: AccessCatalog): UserAccessValidation {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  if (!isManageableRole(record.rol)) return { ok: false, error: "Rol no válido" };

  const empresaId = record.empresaId;
  if (typeof empresaId !== "number" || !Number.isSafeInteger(empresaId) || !catalog.empresaIds.has(empresaId)) {
    return { ok: false, error: "Empresa no válida" };
  }

  const restaurantIds = positiveIntList(record.restaurantIds);
  const marcaIds = positiveIntList(record.marcaIds);
  if (!restaurantIds || !marcaIds) return { ok: false, error: "Selección no válida" };

  const ofEmpresa = catalog.restaurants.filter((restaurant) => restaurant.empresaId === empresaId);

  if (record.rol === "restaurante_user") {
    const allowed = new Set(ofEmpresa.map((restaurant) => restaurant.id));
    if (!restaurantIds.every((id) => allowed.has(id))) {
      return { ok: false, error: "Hay restaurantes que no son de la empresa de la persona" };
    }
    return { ok: true, value: { rol: record.rol, empresaId, restaurantIds, marcaIds: [] } };
  }

  if (record.rol === "marca_admin") {
    const allowed = new Set(ofEmpresa.map((restaurant) => restaurant.marcaId).filter((id): id is number => id !== null));
    if (!marcaIds.every((id) => allowed.has(id))) {
      return { ok: false, error: "Hay marcas que no pertenecen a la empresa de la persona" };
    }
    return { ok: true, value: { rol: record.rol, empresaId, restaurantIds: [], marcaIds } };
  }

  return { ok: true, value: { rol: "empresa_admin", empresaId, restaurantIds: [], marcaIds: [] } };
}

export type ManageDecision = { ok: true } | { ok: false; status: 403; error: string };

/**
 * ¿Puede `actor` cambiar el acceso de `target`? Solo un super_admin, nunca el
 * propio y nunca sobre otro super_admin: nadie amplía su propio alcance ni crea
 * super_admins desde la web.
 */
export function canManageUserAccess(
  actor: { userId: string; rol: string | null | undefined },
  target: { userId: string; rol: string | null | undefined }
): ManageDecision {
  if (actor.rol !== "super_admin") return { ok: false, status: 403, error: "No autorizado" };
  if (actor.userId === target.userId) return { ok: false, status: 403, error: "No puedes cambiar tu propio acceso" };
  if (target.rol === "super_admin") return { ok: false, status: 403, error: "Un super_admin no se gestiona desde aquí" };
  return { ok: true };
}
