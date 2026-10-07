/**
 * Permisos de un CONTACTO de WhatsApp (quien recibe informes y alertas, o consulta
 * al bot). Son independientes de las cuentas web de Nexo: se gestionan en
 * Conversations y salen SOLO de las tablas del contacto:
 *
 *   conv_contacto_empresas      empresa (+ todos_restaurantes)
 *   conv_contacto_restaurantes  restaurantes concretos
 *
 * `conv_contactos.usuario_id` (cuenta web) es solo un vínculo informativo opcional y
 * NO interviene en el alcance. El "tipo" del contacto es descriptivo y tampoco decide
 * permisos. Funciones puras: sin acceso a datos ni dependencia de Next.
 */

export const CONTACT_TYPES = [
  { id: "direccion", label: "Dirección" },
  { id: "operaciones", label: "Operaciones" },
  { id: "supervisor", label: "Supervisor" },
  { id: "responsable_marca", label: "Responsable de marca" },
  { id: "responsable_restaurante", label: "Responsable de restaurante" },
  { id: "otro", label: "Otro" },
] as const;

export type ContactTypeId = (typeof CONTACT_TYPES)[number]["id"];

export function isContactType(value: unknown): value is ContactTypeId {
  return CONTACT_TYPES.some((type) => type.id === value);
}

export function contactTypeLabel(id: string | null | undefined): string | null {
  return CONTACT_TYPES.find((type) => type.id === id)?.label ?? null;
}

// Resolución del alcance ----------------------------------------------------------------

export type ContactGrants = {
  /** Filas de conv_contacto_empresas del contacto. */
  empresas: { empresaId: number; todosRestaurantes: boolean }[];
  /** Filas de conv_contacto_restaurantes del contacto. */
  restaurantes: { empresaId: number; restauranteId: number }[];
};

/**
 * Restaurantes que el contacto puede consultar HOY, ordenados y sin duplicados.
 * DENY BY DEFAULT:
 *  - sin empresa ni asignaciones → ninguno;
 *  - `todosRestaurantes` → todos los restaurantes ACTUALES de esa empresa (los
 *    nuevos entran solos; no se guarda ninguna lista);
 *  - selección explícita → solo los elegidos, y solo si el restaurante sigue
 *    siendo de esa empresa (un restaurante nuevo NO entra por sí solo);
 *  - una asignación sin su empresa se ignora.
 */
export function resolveRestaurantIds(
  grants: ContactGrants,
  restaurants: readonly { id: number; empresaId: number | null }[]
): number[] {
  const ids = new Set<number>();

  for (const empresa of grants.empresas) {
    const ofEmpresa = restaurants.filter((restaurant) => restaurant.empresaId === empresa.empresaId);
    if (empresa.todosRestaurantes) {
      for (const restaurant of ofEmpresa) ids.add(restaurant.id);
      continue;
    }
    const existing = new Set(ofEmpresa.map((restaurant) => restaurant.id));
    for (const row of grants.restaurantes) {
      if (row.empresaId === empresa.empresaId && existing.has(row.restauranteId)) ids.add(row.restauranteId);
    }
  }

  return [...ids].sort((a, b) => a - b);
}

// Validación de lo que se guarda ----------------------------------------------------------

export type ContactAccessCatalog = {
  empresaIds: ReadonlySet<number>;
  restaurants: readonly { id: number; empresaId: number | null }[];
};

export type ContactAccessValue = {
  tipo: ContactTypeId | null;
  /** `null` = sin empresa → sin acceso a datos. */
  empresaId: number | null;
  todosRestaurantes: boolean;
  /** Vacío con `todosRestaurantes` o sin empresa. */
  restaurantIds: number[];
};

export type ContactAccessValidation = { ok: true; value: ContactAccessValue } | { ok: false; error: string };

function idList(value: unknown): number[] | null {
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
 * Valida y normaliza el tipo, la empresa y los restaurantes de un contacto.
 * Rechaza restaurantes de otra empresa o inexistentes (la base de datos lo vuelve a
 * comprobar). Sin empresa, o con "todos", no se guarda ninguna lista de restaurantes.
 */
export function validateContactAccess(input: unknown, catalog: ContactAccessCatalog): ContactAccessValidation {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  let tipo: ContactTypeId | null = null;
  if (record.tipo !== undefined && record.tipo !== null && record.tipo !== "") {
    if (!isContactType(record.tipo)) return { ok: false, error: "Tipo de contacto no válido" };
    tipo = record.tipo;
  }

  const rawEmpresa = record.empresaId;
  if (rawEmpresa === undefined || rawEmpresa === null || rawEmpresa === "") {
    return { ok: true, value: { tipo, empresaId: null, todosRestaurantes: false, restaurantIds: [] } };
  }
  if (typeof rawEmpresa !== "number" || !Number.isSafeInteger(rawEmpresa) || !catalog.empresaIds.has(rawEmpresa)) {
    return { ok: false, error: "Empresa no válida" };
  }

  const todos = record.todosRestaurantes === true;
  if (record.todosRestaurantes !== undefined && typeof record.todosRestaurantes !== "boolean") {
    return { ok: false, error: "Selección no válida" };
  }

  const restaurantIds = idList(record.restaurantIds);
  if (!restaurantIds) return { ok: false, error: "Selección no válida" };

  if (todos) return { ok: true, value: { tipo, empresaId: rawEmpresa, todosRestaurantes: true, restaurantIds: [] } };

  const allowed = new Set(catalog.restaurants.filter((r) => r.empresaId === rawEmpresa).map((r) => r.id));
  if (!restaurantIds.every((id) => allowed.has(id))) {
    return { ok: false, error: "Hay restaurantes que no son de la empresa elegida" };
  }
  return { ok: true, value: { tipo, empresaId: rawEmpresa, todosRestaurantes: false, restaurantIds } };
}
