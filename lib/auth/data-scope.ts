import type { UserScope } from "@/lib/auth/types";
import { isSuperAdmin, isUnrestrictedScope } from "@/lib/auth/permissions";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { KpiDiarioRow } from "@/lib/supabase/kpi-diario";

function allowedRestauranteSet(scope: UserScope): Set<number> | null {
  if (isSuperAdmin(scope.rol) || isUnrestrictedScope(scope)) return null;
  return new Set(scope.restauranteIds ?? []);
}

export function filterKpiRowsByScope(
  rows: KpiRestaurantRow[],
  scope: UserScope
): KpiRestaurantRow[] {
  const allowed = allowedRestauranteSet(scope);
  if (!allowed) return rows;
  return rows.filter((row) => allowed.has(row.restaurante_id));
}

export function filterResenasByScope(rows: ResenaRow[], scope: UserScope): ResenaRow[] {
  const allowed = allowedRestauranteSet(scope);
  if (!allowed) return rows;

  return rows.filter((row) => {
    const id = row.restaurante_id;
    return id != null && allowed.has(Number(id));
  });
}

export function filterKpiDiarioByScope(rows: KpiDiarioRow[], scope: UserScope): KpiDiarioRow[] {
  const allowed = allowedRestauranteSet(scope);
  if (!allowed) return rows;

  return rows.filter((row) => {
    const id = row.restaurante_id;
    return id != null && allowed.has(Number(id));
  });
}

export function assertRestauranteInScope(scope: UserScope, restauranteId: number): boolean {
  const allowed = allowedRestauranteSet(scope);
  if (!allowed) return true;
  return allowed.has(restauranteId);
}
