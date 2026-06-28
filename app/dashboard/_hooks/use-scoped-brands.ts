"use client";

import { useMemo } from "react";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { resolveVisibleBrandCatalog, shouldShowBrandFilter } from "@/lib/auth/brand-scope";
import { tenant } from "../tenant";
import { useAuth } from "../_components/auth-context";

/** Marcas que el usuario puede ver en filtros (según rol, asignaciones y datos cargados). */
export function useScopedBrands(sourceBrands?: readonly BrandId[]) {
  const { scope } = useAuth();
  return useMemo(
    () => resolveVisibleBrandCatalog(scope, sourceBrands),
    [scope, sourceBrands]
  );
}

/** true si el perfil puede elegir entre varias marcas. */
export function useBrandFilterEnabled(sourceBrands?: readonly BrandId[]) {
  const { scope } = useAuth();
  return useMemo(
    () => shouldShowBrandFilter(scope, sourceBrands),
    [scope, sourceBrands]
  );
}

/** Etiqueta del chip «ver todas las marcas» en Restaurantes. */
export function useAllBrandsLabel() {
  const { empresaNombre, showGrupoHambarClientBadge } = useAuth();
  return useMemo(() => {
    if (showGrupoHambarClientBadge) {
      return tenant.name;
    }
    return empresaNombre?.trim() || "Todas";
  }, [empresaNombre, showGrupoHambarClientBadge]);
}
