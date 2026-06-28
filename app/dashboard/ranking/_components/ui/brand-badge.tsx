import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { BrandMark } from "@/app/dashboard/_components/brand-mark";
import type { BrandLogoSize } from "@/lib/restaurants/brand-visuals";

const sizeMap: Record<"sm" | "md" | "lg", BrandLogoSize> = {
  sm: "xs",
  md: "sm",
  lg: "md",
};

/** @deprecated Usar BrandMark o RestaurantBrandLine */
export function BrandBadge({ brand, size = "md" }: { brand: BrandId; size?: "sm" | "md" | "lg" }) {
  return <BrandMark brand={brand} size={sizeMap[size]} />;
}
