import "server-only";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { fetchUserScope } from "@/lib/auth/scopes";
import type { Perfil, UserScope } from "@/lib/auth/types";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import {
  narrowScopeToCompany,
  pickActiveCompany,
  resolveCompanyAccess,
  type CompanyAccess,
  type CompanyOption,
} from "./access";
import { loadCompanyDirectory } from "./directory.server";

export type CompanyContext = CompanyAccess & {
  activeCompany: CompanyOption | null;
  /** Alcance ya acotado a la empresa activa (vacío si todavía no hay empresa activa). */
  scope: UserScope;
};

const EMPTY_PARTS = { restaurantIds: [], marcaIds: [], brandIds: [] } as const;

/**
 * Resuelve, EN EL SERVIDOR y en cada petición, las empresas permitidas del usuario y su empresa activa.
 * `cookieValue` es solo una petición del navegador: se valida contra las empresas permitidas.
 * Cualquier fallo al leer la base de datos deja al usuario sin empresas (deny by default).
 */
export async function resolveCompanyContext(input: {
  userId: string;
  perfil: Perfil;
  baseScope: UserScope;
  cookieValue: string | null | undefined;
  /** Clave de la sesión de autenticación actual (para atar la elección del super_admin a esta sesión). */
  sessionKey?: string | null;
}): Promise<CompanyContext> {
  const { userId, perfil, baseScope } = input;
  const rol = normalizeRole(perfil.rol);
  const denied = (): CompanyContext => ({
    companies: [],
    restaurantIdsByCompany: new Map(),
    activeCompany: null,
    scope: narrowScopeToCompany(baseScope, null, EMPTY_PARTS),
  });
  if (!rol) return denied();

  try {
    // Alcance REAL por rol, aunque el filtrado de datos esté desactivado en esta fase: define qué empresas existen para él.
    const permitted = isSuperAdmin(rol)
      ? null
      : (baseScope.restauranteIds ?? (await fetchUserScope(userId, perfil, { enforceScoping: true })).restauranteIds ?? []);

    const directory = await loadCompanyDirectory();
    const access = resolveCompanyAccess({
      rol,
      perfilCompanyId: perfil.empresaId ? Number(perfil.empresaId) : null,
      permittedRestaurantIds: permitted,
      companies: directory.companies,
      restaurants: directory.restaurants,
    });
    // super_admin: cada sesión nueva empieza en la selección; usuarios normales: como siempre.
    const activeCompany = pickActiveCompany(access, input.cookieValue, {
      requireFreshSelection: isSuperAdmin(rol),
      sessionKey: input.sessionKey ?? null,
    });
    if (!activeCompany) {
      return { ...access, activeCompany: null, scope: narrowScopeToCompany(baseScope, null, EMPTY_PARTS) };
    }

    const restaurantIds = access.restaurantIdsByCompany.get(activeCompany.id) ?? [];
    const inCompany = new Set(restaurantIds);
    const marcaIds = [
      ...new Set(
        directory.restaurants
          .filter((restaurant) => inCompany.has(restaurant.id) && restaurant.brandId !== null)
          .map((restaurant) => restaurant.brandId as number)
      ),
    ];
    const brandIds: BrandId[] = [
      ...new Set(
        marcaIds
          .map((id) => directory.brandNameById.get(id))
          .filter((name): name is string => Boolean(name))
          .map((name) => marcaToBrandId(name))
      ),
    ];

    return {
      ...access,
      activeCompany,
      scope: narrowScopeToCompany(baseScope, activeCompany, { restaurantIds, marcaIds, brandIds }),
    };
  } catch (error) {
    console.error("[company] context failed", error instanceof Error ? error.message : "unknown");
    return denied();
  }
}
