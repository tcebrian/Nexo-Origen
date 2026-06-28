import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { DATA_SCOPING_ENABLED } from "@/lib/auth/config";
import { filterKpiRowsByScope } from "@/lib/auth/data-scope";
import { isUnrestrictedScope } from "@/lib/auth/permissions";
import type { UserScope } from "@/lib/auth/types";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";

/** Comprueba si el slug de restaurante está dentro del alcance del usuario (fase 2). */
export async function isRestauranteSlugInScope(
  scope: UserScope,
  slug: string
): Promise<boolean> {
  if (!DATA_SCOPING_ENABLED || isUnrestrictedScope(scope)) return true;

  const rows = filterKpiRowsByScope(await fetchAllKpiRows(), scope);
  return rows.some((row) => restaurantSlug(row.restaurante) === slug);
}
