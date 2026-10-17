import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { UserScope } from "@/lib/auth/types";

/**
 * EMPRESA ACTIVA — reglas puras (sin acceso a datos, sin Next).
 *
 * El usuario trabaja siempre dentro de UNA empresa activa. Esa elección vive en una cookie httpOnly, pero la
 * cookie NUNCA es una autoridad: en cada petición el servidor recalcula las empresas a las que el usuario
 * tiene acceso (desde su rol y sus asignaciones reales) y solo acepta la de la cookie si está entre ellas.
 * Un id manipulado (cookie, URL, cuerpo) que no esté permitido se ignora: deny by default.
 */

export const ACTIVE_COMPANY_COOKIE = "nexo_active_company";
export const ACTIVE_COMPANY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const COMPANY_SELECTION_PATH = "/seleccionar-empresa";

export type CompanyOption = { id: number; name: string };
export type CompanyRecord = { id: number; name: string; active: boolean };
export type RestaurantRecord = { id: number; companyId: number | null; brandId: number | null };

export type CompanyAccess = {
  /** Empresas a las que el usuario puede acceder, por nombre. Dinámicas: salen de la base de datos. */
  companies: CompanyOption[];
  /** Restaurantes que el usuario puede ver DENTRO de cada empresa (nunca los de otra). */
  restaurantIdsByCompany: ReadonlyMap<number, readonly number[]>;
};

/**
 * Empresas accesibles y, de cada una, los restaurantes permitidos.
 *  - super_admin (`permittedRestaurantIds = null`): todas las empresas activas y todos sus restaurantes.
 *  - resto: solo las empresas de los restaurantes que ya tiene permitidos (alcance REAL por rol, aunque el
 *    filtrado de datos esté desactivado) y, para empresa_admin, su empresa de perfil.
 */
export function resolveCompanyAccess(input: {
  rol: string;
  perfilCompanyId: number | null;
  /** `null` = sin restricción (solo super_admin). */
  permittedRestaurantIds: readonly number[] | null;
  companies: readonly CompanyRecord[];
  restaurants: readonly RestaurantRecord[];
}): CompanyAccess {
  const permitted = input.permittedRestaurantIds === null ? null : new Set(input.permittedRestaurantIds);
  const idsByCompany = new Map<number, number[]>();

  for (const restaurant of input.restaurants) {
    if (restaurant.companyId === null) continue;
    if (permitted && !permitted.has(restaurant.id)) continue;
    idsByCompany.set(restaurant.companyId, [...(idsByCompany.get(restaurant.companyId) ?? []), restaurant.id]);
  }

  const eligible = (company: CompanyRecord) => {
    if (!company.active) return false;
    if (permitted === null) return true; // super_admin
    if (idsByCompany.has(company.id)) return true;
    return input.rol === "empresa_admin" && input.perfilCompanyId === company.id;
  };

  const companies = input.companies
    .filter(eligible)
    .map((company): CompanyOption => ({ id: company.id, name: company.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es") || a.id - b.id);

  return {
    companies,
    restaurantIdsByCompany: new Map(
      companies.map((company) => [company.id, [...(idsByCompany.get(company.id) ?? [])].sort((a, b) => a - b)])
    ),
  };
}

/**
 * Valor de la cookie: `<empresa>` (usuarios normales) o `<empresa>.<clave de sesión>` (super_admin).
 * La clave ata la elección a UNA sesión de autenticación: tras un login nuevo la cookie anterior ya no vale.
 */
export function encodeCompanyCookie(companyId: number, sessionKey: string | null): string {
  return sessionKey ? `${companyId}.${sessionKey}` : String(companyId);
}

export function parseCompanyCookie(raw: unknown): { companyId: number; sessionKey: string | null } | null {
  if (typeof raw !== "string") return null;
  const [idPart, keyPart, ...rest] = raw.trim().split(".");
  if (rest.length > 0) return null;
  const companyId = parseCompanyId(idPart);
  if (companyId === null) return null;
  if (keyPart === undefined) return { companyId, sessionKey: null };
  return /^[0-9a-f]{8,64}$/.test(keyPart) ? { companyId, sessionKey: keyPart } : null;
}

/** Interpreta el valor de la cookie: solo enteros positivos; cualquier otra cosa es "sin valor". */
export function parseCompanyId(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string" || !/^[1-9]\d{0,15}$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Empresa activa: la de la cookie SI está permitida; si solo hay una, esa; si no, `null` (hay que elegir).
 * Una cookie con una empresa no permitida se ignora (nunca da acceso).
 */
export function pickActiveCompany(
  access: Pick<CompanyAccess, "companies">,
  cookieValue: unknown,
  /**
   * `requireFreshSelection` (super_admin): la empresa solo vale si se eligió en ESTA sesión (la clave de la
   * cookie coincide con `sessionKey`) y nunca se entra automáticamente por tener una sola empresa. Cada login
   * nuevo empieza, por tanto, en la selección. Usuarios normales: sin cambios.
   */
  binding: { requireFreshSelection: boolean; sessionKey: string | null } = { requireFreshSelection: false, sessionKey: null }
): CompanyOption | null {
  const cookie = parseCompanyCookie(cookieValue);
  const sameSession = cookie !== null && cookie.sessionKey !== null && cookie.sessionKey === binding.sessionKey;
  const usable = cookie !== null && (!binding.requireFreshSelection || sameSession);
  const chosen = usable ? access.companies.find((company) => company.id === cookie.companyId) : undefined;
  if (chosen) return chosen;
  if (binding.requireFreshSelection) return null;
  return access.companies.length === 1 ? access.companies[0]! : null;
}

export type CompanySelectionResult =
  | { ok: true; company: CompanyOption }
  | { ok: false; status: 400 | 403; error: string };

/** Valida una petición de "seleccionar empresa" contra las empresas permitidas calculadas en el servidor. */
export function validateCompanySelection(access: Pick<CompanyAccess, "companies">, requested: unknown): CompanySelectionResult {
  const id = parseCompanyId(requested);
  if (id === null) return { ok: false, status: 400, error: "Empresa no válida" };
  const company = access.companies.find((item) => item.id === id);
  if (!company) return { ok: false, status: 403, error: "No tienes acceso a esa empresa" };
  return { ok: true, company };
}

/**
 * Alcance de datos ACOTADO a la empresa activa. Es la pieza que hace que el filtro no sea solo visual: todo el
 * código existente que recibe `session.scope` (dashboard, reseñas, informes…) pasa a ver únicamente los
 * restaurantes de esa empresa que el usuario ya podía ver.
 *  - sin empresa activa → alcance vacío (deny by default): ningún dato hasta elegir empresa.
 */
export function narrowScopeToCompany(
  base: UserScope,
  company: CompanyOption | null,
  parts: { restaurantIds: readonly number[]; marcaIds: readonly number[]; brandIds: readonly BrandId[] }
): UserScope {
  if (!company) {
    return { ...base, empresaId: null, empresaNombre: null, marcaIds: [], restauranteIds: [], brandIds: [] };
  }
  return {
    ...base,
    empresaId: String(company.id),
    empresaNombre: company.name,
    marcaIds: [...parts.marcaIds],
    restauranteIds: [...parts.restaurantIds],
    brandIds: [...parts.brandIds],
  };
}
