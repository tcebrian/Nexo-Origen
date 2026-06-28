import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { AllBrandsMark } from "./all-brands-mark";
import { BrandMark } from "./brand-mark";

type AllBrandsValue = "todas" | "todos";

type BrandFilterLabelProps = {
  value: AllBrandsValue | BrandId;
  label: string;
};

export function isAllBrandsFilter(value: string): value is AllBrandsValue {
  return value === "todas" || value === "todos";
}

export function BrandFilterLabel({ value, label }: BrandFilterLabelProps) {
  if (isAllBrandsFilter(value)) {
    return <AllBrandsMark size="chip" alt={label} />;
  }

  return <BrandMark brand={value} size="chip" />;
}
