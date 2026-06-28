import Image from "next/image";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import {
  BRAND_RAIL_LOGO_BOX,
  BRAND_VISUALS,
  SHARED_BRAND_LOGO_SIZES,
  type BrandLogoSize,
} from "@/lib/restaurants/brand-visuals";

type BrandMarkProps = {
  brand: BrandId;
  size?: BrandLogoSize;
  className?: string;
};

const monogramSizeMap: Record<BrandLogoSize, string> = {
  chip: "h-6 min-w-6 px-1 text-[7px]",
  xs: "h-7 w-7 text-[8px]",
  sm: "h-9 w-9 text-[10px]",
  md: "h-11 w-11 text-[11px]",
  lg: "h-14 w-14 text-[12px]",
  rail: "h-11 w-11 text-[11px]",
};

export function BrandMark({ brand, size = "md", className = "" }: BrandMarkProps) {
  const visual = BRAND_VISUALS[brand];
  const logoClass = SHARED_BRAND_LOGO_SIZES[size];

  if (visual.logo) {
    const intrinsic = visual.logoIntrinsic ?? { width: 512, height: 256 };

    const image = (
      <Image
        src={visual.logo}
        alt={visual.monogram}
        width={intrinsic.width}
        height={intrinsic.height}
        unoptimized
        className={`block object-contain object-center ${logoClass}`}
        priority={size === "lg" || size === "rail"}
      />
    );

    if (size === "rail") {
      return <div className={`${BRAND_RAIL_LOGO_BOX} ${className}`}>{image}</div>;
    }

    return <div className={`inline-flex shrink-0 items-center ${className}`}>{image}</div>;
  }

  const monogramInner = (
    <div
      className={`flex items-center justify-center rounded-xl border font-bold tracking-tight ${monogramSizeMap[size]}`}
      style={{
        borderColor: `${visual.accent}55`,
        backgroundColor: `${visual.accent}18`,
        color: visual.accent,
      }}
    >
      {visual.monogram}
    </div>
  );

  if (size === "rail") {
    return <div className={`${BRAND_RAIL_LOGO_BOX} ${className}`}>{monogramInner}</div>;
  }

  return <div className={`shrink-0 ${className}`}>{monogramInner}</div>;
}
