import "server-only";

import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import type { AssignedRestaurant } from "@/lib/auth/types";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

async function fetchUsuarioRestauranteIds(userId: string): Promise<number[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];

  const { data, error } = await client
    .from(SUPABASE_TABLES.usuario_restaurantes)
    .select("restaurante_id")
    .eq("user_id", userId);

  if (error) return [];
  return (data ?? [])
    .map((row) => Number((row as { restaurante_id: unknown }).restaurante_id))
    .filter((id) => Number.isFinite(id));
}

/** Resuelve una lista de ids de restaurante contra el catálogo KPI. */
export async function resolveRestaurantsByIds(ids: number[]): Promise<AssignedRestaurant[]> {
  if (ids.length === 0) return [];

  const catalog = await fetchAllKpiRows();
  const byId = new Map(catalog.map((row) => [row.restaurante_id, row]));

  return ids
    .map((id) => {
      const row = byId.get(id);
      if (!row) return null;
      return {
        id,
        slug: restaurantSlug(row.restaurante),
        name: row.restaurante,
        location: row.ciudad,
        brand: marcaToBrandId(row.marca),
        brandLabel: row.marca,
      } satisfies AssignedRestaurant;
    })
    .filter((entry): entry is AssignedRestaurant => entry != null);
}

/** Restaurantes asignados al usuario (tabla usuario_restaurantes + catálogo KPI). */
export async function fetchAssignedRestaurants(userId: string): Promise<AssignedRestaurant[]> {
  const ids = await fetchUsuarioRestauranteIds(userId);
  return resolveRestaurantsByIds(ids);
}
