"use client";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { ScopedBrandRail } from "../../_components/scoped-brand-rail";

type PreventBrandRailProps = {
  selectedBrand: "todas" | BrandId;
  onBrandChange: (brand: "todas" | BrandId) => void;
  sourceBrands?: readonly BrandId[];
};

/** Mismo selector de marca que Restaurantes (logos + Grupo Hámbar). */
export function PreventBrandRail({
  selectedBrand,
  onBrandChange,
  sourceBrands,
}: PreventBrandRailProps) {
  return (
    <ScopedBrandRail
      allValue="todas"
      selectedBrand={selectedBrand}
      onBrandChange={onBrandChange}
      sourceBrands={sourceBrands}
      showLabel
      className="mb-0"
    />
  );
}
