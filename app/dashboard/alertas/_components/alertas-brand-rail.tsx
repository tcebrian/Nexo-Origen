"use client";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { ScopedBrandRail } from "../../_components/scoped-brand-rail";

type AlertasBrandRailProps = {
  selectedBrand: "todas" | BrandId;
  onBrandChange: (brand: "todas" | BrandId) => void;
};

/** Marcas del perfil (alcance), aunque no tengan alertas en el periodo. */
export function AlertasBrandRail({ selectedBrand, onBrandChange }: AlertasBrandRailProps) {
  return (
    <ScopedBrandRail
      allValue="todas"
      selectedBrand={selectedBrand}
      onBrandChange={onBrandChange}
      showLabel
      className="mb-0"
    />
  );
}
