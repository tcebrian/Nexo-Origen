"use client";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { ScopedBrandRail } from "../../_components/scoped-brand-rail";

type RestaurantesBrandRailProps = {
  selectedBrand: "todas" | BrandId;
  onBrandChange: (brand: "todas" | BrandId) => void;
  sourceBrands?: readonly BrandId[];
};

export function RestaurantesBrandRail({
  selectedBrand,
  onBrandChange,
  sourceBrands,
}: RestaurantesBrandRailProps) {
  return (
    <ScopedBrandRail
      allValue="todas"
      selectedBrand={selectedBrand}
      onBrandChange={onBrandChange}
      sourceBrands={sourceBrands}
      showLabel
      className="mb-8"
    />
  );
}
