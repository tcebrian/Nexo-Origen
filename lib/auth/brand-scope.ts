import { brands, type BrandId } from "@/app/dashboard/restaurantes/data";
import { isUnrestrictedScope } from "@/lib/auth/permissions";
import type { UserScope } from "@/lib/auth/types";

/** Marcas visibles en filtros UI según el alcance del usuario. */
export function getVisibleBrandCatalog(scope: UserScope): { id: BrandId; name: string }[] {
  if (isUnrestrictedScope(scope) || scope.brandIds === null) {
    return brands;
  }
  const allowed = new Set(scope.brandIds);
  return brands.filter((entry) => allowed.has(entry.id));
}

/**
 * Marcas para el selector con logos: prioriza alcance del perfil y,
 * si hace falta, las marcas presentes en los restaurantes ya cargados.
 */
export function resolveVisibleBrandCatalog(
  scope: UserScope,
  sourceBrands?: readonly BrandId[]
): { id: BrandId; name: string }[] {
  const fromScope = getVisibleBrandCatalog(scope);

  if (!sourceBrands?.length) {
    return fromScope;
  }

  const uniqueIds = [...new Set(sourceBrands)];
  const fromData = brands.filter((entry) => uniqueIds.includes(entry.id));

  if (fromScope.length === 0) {
    return fromData;
  }

  if (isUnrestrictedScope(scope) || scope.brandIds === null) {
    return fromData.length > 0 ? fromData : fromScope;
  }

  const allowed = new Set(fromScope.map((entry) => entry.id));
  const merged = fromData.filter((entry) => allowed.has(entry.id));
  return merged.length > 0 ? merged : fromScope;
}

/** Filtra una lista de BrandId contra el alcance (p. ej. informes). */
export function filterBrandIdsByScope(scope: UserScope, ids: readonly BrandId[]): BrandId[] {
  if (isUnrestrictedScope(scope) || scope.brandIds === null) {
    return [...ids];
  }
  const allowed = new Set(scope.brandIds);
  return ids.filter((id) => allowed.has(id));
}

export function isBrandInScope(scope: UserScope, brandId: BrandId): boolean {
  if (isUnrestrictedScope(scope) || scope.brandIds === null) return true;
  return scope.brandIds.includes(brandId);
}

export function shouldShowBrandFilter(scope: UserScope, sourceBrands?: readonly BrandId[]): boolean {
  return resolveVisibleBrandCatalog(scope, sourceBrands).length > 1;
}
