import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { Perfil, UserRole, UserScope } from "@/lib/auth/types";
import { DATA_SCOPING_ENABLED } from "@/lib/auth/config";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

function emptyScope(rol: UserRole, empresaId: string | null = null): UserScope {
  return {
    rol,
    empresaId,
    empresaNombre: null,
    marcaIds: [],
    restauranteIds: [],
    brandIds: [],
  };
}

function unrestrictedScope(rol: UserRole): UserScope {
  return {
    rol,
    empresaId: null,
    empresaNombre: null,
    marcaIds: null,
    restauranteIds: null,
    brandIds: null,
  };
}

async function fetchEmpresaNombre(
  client: SupabaseClient,
  empresaId: string
): Promise<string | null> {
  const { data, error } = await client
    .from(SUPABASE_TABLES.empresas)
    .select("nombre")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !data) return null;
  return typeof data.nombre === "string" ? data.nombre : null;
}

/**
 * `marcas` no tiene columna `empresa_id` — se deriva desde `restaurantes`
 * (que sí tiene `empresa_id` y `marca_id`).
 */
async function fetchMarcaIdsByEmpresa(
  client: SupabaseClient,
  empresaId: string
): Promise<number[]> {
  const { data, error } = await client
    .from(SUPABASE_TABLES.restaurantes)
    .select("marca_id")
    .eq("empresa_id", empresaId);

  if (error) return [];
  const marcaIds = (data ?? [])
    .map((row) => Number((row as { marca_id: unknown }).marca_id))
    .filter((id) => Number.isFinite(id));
  return Array.from(new Set(marcaIds));
}

async function fetchRestauranteIdsByMarcaIds(
  client: SupabaseClient,
  marcaIds: number[]
): Promise<number[]> {
  if (marcaIds.length === 0) return [];

  const { data, error } = await client
    .from(SUPABASE_TABLES.restaurantes)
    .select("id")
    .in("marca_id", marcaIds);

  if (error) return [];
  return (data ?? [])
    .map((row) => Number((row as { id: unknown }).id))
    .filter((id) => Number.isFinite(id));
}

async function fetchRestauranteIdsByEmpresa(
  client: SupabaseClient,
  empresaId: string
): Promise<number[]> {
  const { data, error } = await client
    .from(SUPABASE_TABLES.restaurantes)
    .select("id")
    .eq("empresa_id", empresaId);

  if (error) return [];
  return (data ?? [])
    .map((row) => Number((row as { id: unknown }).id))
    .filter((id) => Number.isFinite(id));
}

async function fetchUsuarioMarcaIds(
  client: SupabaseClient,
  userId: string
): Promise<number[]> {
  const { data, error } = await client
    .from(SUPABASE_TABLES.usuario_marcas)
    .select("marca_id")
    .eq("user_id", userId);

  if (error) return [];
  return (data ?? [])
    .map((row) => Number((row as { marca_id: unknown }).marca_id))
    .filter((id) => Number.isFinite(id));
}

async function fetchUsuarioRestauranteIds(
  client: SupabaseClient,
  userId: string
): Promise<number[]> {
  const { data, error } = await client
    .from(SUPABASE_TABLES.usuario_restaurantes)
    .select("restaurante_id")
    .eq("user_id", userId);

  if (error) return [];
  return (data ?? [])
    .map((row) => Number((row as { restaurante_id: unknown }).restaurante_id))
    .filter((id) => Number.isFinite(id));
}

async function resolveBrandIdsFromMarcaIds(
  client: SupabaseClient,
  marcaIds: number[]
): Promise<BrandId[]> {
  if (marcaIds.length === 0) return [];

  const { data, error } = await client
    .from(SUPABASE_TABLES.marcas)
    .select("nombre")
    .in("id", marcaIds);

  if (error) return [];

  const unique = new Set<BrandId>();
  for (const row of data ?? []) {
    const nombre = String((row as { nombre: unknown }).nombre ?? "").trim();
    if (nombre) unique.add(marcaToBrandId(nombre));
  }
  return Array.from(unique);
}

async function resolveBrandIdsFromRestauranteIds(
  client: SupabaseClient,
  restauranteIds: number[]
): Promise<BrandId[]> {
  if (restauranteIds.length === 0) return [];

  const { data, error } = await client
    .from(SUPABASE_TABLES.restaurantes)
    .select("marca_id")
    .in("id", restauranteIds);

  if (error) return [];

  const marcaIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => Number((row as { marca_id: unknown }).marca_id))
        .filter((id) => Number.isFinite(id))
    )
  );

  return resolveBrandIdsFromMarcaIds(client, marcaIds);
}

/**
 * Resuelve el alcance de datos del usuario.
 * super_admin: sin filtros (ignora perfil.empresa_id aunque sea NULL).
 */
export async function fetchUserScope(userId: string, perfil: Perfil): Promise<UserScope> {
  const rol = normalizeRole(perfil.rol);
  if (!rol) return emptyScope("restaurante_user");

  if (isSuperAdmin(rol)) {
    return unrestrictedScope(rol);
  }

  if (!DATA_SCOPING_ENABLED) {
    return unrestrictedScope(rol);
  }

  const client = getSupabaseAdmin();
  if (!client) {
    console.warn("[fetchUserScope] Sin service role; alcance vacío para rol restringido.");
    return emptyScope(rol, perfil.empresaId);
  }

  const authUserId = userId.trim();
  const empresaId = perfil.empresaId;
  const empresaNombre = empresaId ? await fetchEmpresaNombre(client, empresaId) : null;

  if (rol === "empresa_admin") {
    if (!empresaId) {
      return { ...emptyScope(rol), empresaId: null, empresaNombre };
    }

    const marcaIds = await fetchMarcaIdsByEmpresa(client, empresaId);
    let restauranteIds = await fetchRestauranteIdsByEmpresa(client, empresaId);

    if (restauranteIds.length === 0 && marcaIds.length > 0) {
      restauranteIds = await fetchRestauranteIdsByMarcaIds(client, marcaIds);
    }

    const brandIds = await resolveBrandIdsFromMarcaIds(client, marcaIds);

    return {
      rol,
      empresaId,
      empresaNombre,
      marcaIds,
      restauranteIds,
      brandIds,
    };
  }

  if (rol === "marca_admin") {
    const marcaIds = await fetchUsuarioMarcaIds(client, authUserId);
    const restauranteIds = await fetchRestauranteIdsByMarcaIds(client, marcaIds);
    const brandIds = await resolveBrandIdsFromMarcaIds(client, marcaIds);

    return {
      rol,
      empresaId,
      empresaNombre,
      marcaIds,
      restauranteIds,
      brandIds,
    };
  }

  const restauranteIds = await fetchUsuarioRestauranteIds(client, authUserId);
  const brandIds = await resolveBrandIdsFromRestauranteIds(client, restauranteIds);

  return {
    rol,
    empresaId,
    empresaNombre,
    marcaIds: [],
    restauranteIds,
    brandIds,
  };
}
