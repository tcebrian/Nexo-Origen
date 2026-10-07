import "server-only";

import { fetchUserScope } from "@/lib/auth/scopes";
import { fetchPerfilFresh, invalidatePerfilCache } from "@/lib/auth/perfiles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import {
  canManageUserAccess,
  validateUserAccess,
  type AccessCatalog,
  type UserAccessValue,
} from "@/lib/auth/user-access";
import type { Perfil } from "@/lib/auth/types";

/**
 * Gestión del acceso de personas desde la web (solo super_admin, solo servidor).
 * Guarda en perfiles / usuario_marcas / usuario_restaurantes y NO calcula
 * alcances propios: el "acceso efectivo" que se muestra sale de `fetchUserScope`
 * con el alcance forzado, el mismo que usan la web, WhatsApp y los informes.
 */

export class UserAccessError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 500,
    message: string
  ) {
    super(message);
    this.name = "UserAccessError";
  }
}

function admin() {
  const client = getSupabaseAdmin();
  if (!client) throw new UserAccessError(500, "Servicio no configurado");
  return client;
}

type RestaurantRow = {
  id: number;
  nombre: string;
  ciudad: string | null;
  marca_id: number | null;
  empresa_id: number | null;
  activo: boolean | null;
};

async function loadCatalog() {
  const client = admin();
  const [empresas, marcas, restaurantes] = await Promise.all([
    client.from(SUPABASE_TABLES.empresas).select("id,nombre").order("nombre"),
    client.from(SUPABASE_TABLES.marcas).select("id,nombre").order("nombre"),
    client.from(SUPABASE_TABLES.restaurantes).select("id,nombre,ciudad,marca_id,empresa_id,activo").order("nombre"),
  ]);
  if (empresas.error || marcas.error || restaurantes.error) {
    throw new UserAccessError(500, "No se pudo cargar el catálogo");
  }
  return {
    empresas: (empresas.data ?? []) as { id: number; nombre: string }[],
    marcas: (marcas.data ?? []) as { id: number; nombre: string }[],
    restaurantes: (restaurantes.data ?? []) as RestaurantRow[],
  };
}

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

function accessCatalog(catalog: Catalog): AccessCatalog {
  return {
    empresaIds: new Set(catalog.empresas.map((empresa) => Number(empresa.id))),
    restaurants: catalog.restaurantes.map((restaurant) => ({
      id: Number(restaurant.id),
      empresaId: restaurant.empresa_id === null ? null : Number(restaurant.empresa_id),
      marcaId: restaurant.marca_id === null ? null : Number(restaurant.marca_id),
    })),
  };
}

export type EffectiveAccess = {
  count: number;
  restaurants: { id: number; name: string; brand: string; city: string }[];
};

/** Acceso efectivo según `fetchUserScope` (alcance forzado). `restauranteIds === null` = todos. */
export async function effectiveAccessFor(perfil: Perfil, catalog?: Catalog): Promise<EffectiveAccess> {
  const data = catalog ?? (await loadCatalog());
  const scope = await fetchUserScope(perfil.id, perfil, { enforceScoping: true });
  const allowed = scope.restauranteIds === null ? null : new Set(scope.restauranteIds);
  const brandName = new Map(data.marcas.map((marca) => [Number(marca.id), marca.nombre]));

  const restaurants = data.restaurantes
    .filter((restaurant) => allowed === null || allowed.has(Number(restaurant.id)))
    .map((restaurant) => ({
      id: Number(restaurant.id),
      name: restaurant.nombre,
      brand: restaurant.marca_id === null ? "" : (brandName.get(Number(restaurant.marca_id)) ?? ""),
      city: restaurant.ciudad ?? "",
    }));
  return { count: restaurants.length, restaurants };
}

/**
 * Rol y nº de restaurantes efectivos de una persona, para el distintivo de la
 * bandeja. Usa `fetchUserScope` (misma lógica que todo) y una caché de 10 s porque
 * la bandeja se refresca cada pocos segundos; el panel de acceso siempre lee en vivo.
 */
const SUMMARY_TTL_MS = 10_000;
const summaryCache = new Map<string, { at: number; value: { rol: string; restaurantCount: number } | null }>();

export async function summarizeUserAccess(userId: string): Promise<{ rol: string; restaurantCount: number } | null> {
  const hit = summaryCache.get(userId);
  if (hit && Date.now() - hit.at < SUMMARY_TTL_MS) return hit.value;

  const perfil = await fetchPerfilFresh(userId);
  let value: { rol: string; restaurantCount: number } | null = null;
  if (perfil) {
    const scope = await fetchUserScope(perfil.id, perfil, { enforceScoping: true });
    let restaurantCount = scope.restauranteIds?.length ?? 0;
    if (scope.restauranteIds === null) {
      const { data } = await admin().from(SUPABASE_TABLES.restaurantes).select("id");
      restaurantCount = data?.length ?? 0;
    }
    value = { rol: perfil.rol, restaurantCount };
  }
  summaryCache.set(userId, { at: Date.now(), value });
  return value;
}

// Listado -------------------------------------------------------------------------------

export type ManagedUserListItem = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId: number | null;
  empresaNombre: string | null;
  restaurantCount: number;
};

async function loadPerfiles(): Promise<(Perfil & { nombre: string })[]> {
  const { data, error } = await admin()
    .from(SUPABASE_TABLES.perfiles)
    .select("id")
    .order("nombre");
  if (error) throw new UserAccessError(500, "No se pudieron cargar los usuarios");
  const perfiles = await Promise.all((data ?? []).map((row) => fetchPerfilFresh(String((row as { id: string }).id))));
  return perfiles.filter((perfil): perfil is Perfil & { nombre: string } => perfil !== null);
}

export async function listManagedUsers(): Promise<ManagedUserListItem[]> {
  const catalog = await loadCatalog();
  const empresaName = new Map(catalog.empresas.map((empresa) => [String(empresa.id), empresa.nombre]));
  const perfiles = await loadPerfiles();

  return Promise.all(
    perfiles.map(async (perfil) => ({
      id: perfil.id,
      nombre: perfil.nombre ?? "",
      email: perfil.email ?? "",
      rol: perfil.rol,
      empresaId: perfil.empresaId === null ? null : Number(perfil.empresaId),
      empresaNombre: perfil.empresaId ? (empresaName.get(perfil.empresaId) ?? null) : null,
      restaurantCount: (await effectiveAccessFor(perfil, catalog)).count,
    }))
  );
}

// Detalle -------------------------------------------------------------------------------

export type ManagedUserDetail = {
  user: { id: string; nombre: string; email: string; rol: string; empresaId: number | null; empresaNombre: string | null };
  /** Selección guardada (lo que edita el formulario). */
  selection: { restaurantIds: number[]; marcaIds: number[] };
  /** Lo que realmente ve hoy (misma lógica que la web y WhatsApp). */
  effective: EffectiveAccess;
  options: {
    empresas: { id: number; nombre: string }[];
    marcas: { id: number; nombre: string; empresaIds: number[] }[];
    restaurants: { id: number; name: string; city: string; brand: string; marcaId: number | null; empresaId: number | null }[];
  };
};

export async function getManagedUserDetail(userId: string): Promise<ManagedUserDetail | null> {
  const perfil = await fetchPerfilFresh(userId);
  if (!perfil) return null;

  const client = admin();
  const catalog = await loadCatalog();
  const [restaurantRows, marcaRows] = await Promise.all([
    client.from(SUPABASE_TABLES.usuario_restaurantes).select("restaurante_id").eq("user_id", userId),
    client.from(SUPABASE_TABLES.usuario_marcas).select("marca_id").eq("user_id", userId),
  ]);
  if (restaurantRows.error || marcaRows.error) throw new UserAccessError(500, "No se pudo cargar el acceso");

  const brandName = new Map(catalog.marcas.map((marca) => [Number(marca.id), marca.nombre]));
  const marcaEmpresas = new Map<number, Set<number>>();
  for (const restaurant of catalog.restaurantes) {
    if (restaurant.marca_id === null || restaurant.empresa_id === null) continue;
    const set = marcaEmpresas.get(Number(restaurant.marca_id)) ?? new Set<number>();
    set.add(Number(restaurant.empresa_id));
    marcaEmpresas.set(Number(restaurant.marca_id), set);
  }
  const empresa = catalog.empresas.find((item) => String(item.id) === perfil.empresaId);

  return {
    user: {
      id: perfil.id,
      nombre: perfil.nombre ?? "",
      email: perfil.email ?? "",
      rol: perfil.rol,
      empresaId: perfil.empresaId === null ? null : Number(perfil.empresaId),
      empresaNombre: empresa?.nombre ?? null,
    },
    selection: {
      restaurantIds: (restaurantRows.data ?? []).map((row) => Number((row as { restaurante_id: number }).restaurante_id)),
      marcaIds: (marcaRows.data ?? []).map((row) => Number((row as { marca_id: number }).marca_id)),
    },
    effective: await effectiveAccessFor(perfil, catalog),
    options: {
      empresas: catalog.empresas.map((item) => ({ id: Number(item.id), nombre: item.nombre })),
      marcas: catalog.marcas.map((marca) => ({
        id: Number(marca.id),
        nombre: marca.nombre,
        empresaIds: [...(marcaEmpresas.get(Number(marca.id)) ?? [])],
      })),
      restaurants: catalog.restaurantes.map((restaurant) => ({
        id: Number(restaurant.id),
        name: restaurant.nombre,
        city: restaurant.ciudad ?? "",
        brand: restaurant.marca_id === null ? "" : (brandName.get(Number(restaurant.marca_id)) ?? ""),
        marcaId: restaurant.marca_id === null ? null : Number(restaurant.marca_id),
        empresaId: restaurant.empresa_id === null ? null : Number(restaurant.empresa_id),
      })),
    },
  };
}

// Guardado ------------------------------------------------------------------------------

/**
 * Deja el acceso de `targetUserId` EXACTAMENTE como la selección final (rol, empresa,
 * restaurantes, marcas) en una única transacción SQL (`nexo_set_user_access`).
 * Valida en servidor (sin fiarse de la interfaz) y la base de datos lo vuelve a validar.
 */
export async function setManagedUserAccess(
  actor: { userId: string; rol: string },
  targetUserId: string,
  input: unknown
): Promise<UserAccessValue> {
  const target = await fetchPerfilFresh(targetUserId);
  if (!target) throw new UserAccessError(404, "Usuario no encontrado");

  const decision = canManageUserAccess(actor, { userId: target.id, rol: target.rol });
  if (!decision.ok) throw new UserAccessError(403, decision.error);

  const catalog = await loadCatalog();
  const validation = validateUserAccess(input, accessCatalog(catalog));
  if (!validation.ok) throw new UserAccessError(400, validation.error);
  const { value } = validation;

  const { error } = await admin().rpc("nexo_set_user_access", {
    p_user_id: target.id,
    p_rol: value.rol,
    p_empresa_id: value.empresaId,
    p_restaurante_ids: value.restaurantIds,
    p_marca_ids: value.marcaIds,
  });

  if (error) {
    // Solo el SQLSTATE: el mensaje de la base de datos puede incluir valores.
    if (error.code === "22023") throw new UserAccessError(400, "Selección no válida");
    if (error.code === "42501") throw new UserAccessError(403, "No autorizado");
    if (error.code === "P0002") throw new UserAccessError(404, "Usuario no encontrado");
    throw new UserAccessError(500, "No se pudo guardar el acceso");
  }

  // Un cambio de rol o de empresa se aplica ya, sin esperar a la caché de perfiles.
  invalidatePerfilCache(target.id);
  return value;
}
