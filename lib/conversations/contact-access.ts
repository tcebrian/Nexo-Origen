import type { UserScope } from "@/lib/auth/types";

/**
 * Piezas puras del acceso de un contacto de WhatsApp. El alcance NO se calcula
 * aquí (lo hace `fetchUserScope`); solo se representa el "sin acceso" y se pasa
 * un alcance a una lista de ids.
 */

/** Alcance sin ningún dato: contacto sin usuario vinculado o con cualquier inconsistencia. */
export const DENY_SCOPE: UserScope = Object.freeze({
  rol: "restaurante_user",
  empresaId: null,
  empresaNombre: null,
  marcaIds: [],
  restauranteIds: [],
  brandIds: [],
}) as UserScope;

/**
 * Lista ordenada y sin duplicados de los restaurantes de un alcance.
 * `restauranteIds === null` (sin restricción) devuelve `allRestaurantIds`.
 */
export function restaurantIdsFromScope(scope: UserScope, allRestaurantIds: readonly number[]): number[] {
  const ids = scope.restauranteIds === null ? allRestaurantIds : scope.restauranteIds;
  return [...new Set(ids)].filter((id) => Number.isFinite(id)).sort((a, b) => a - b);
}
