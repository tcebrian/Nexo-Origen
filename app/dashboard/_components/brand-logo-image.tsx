"use client";

import Image from "next/image";
import { useState } from "react";
import {
  fitLogoInFrame,
  LOGO_FRAME,
  type BrandVisual,
  type BrandLogoSize,
} from "@/lib/restaurants/brand-visuals";

const monogramSize: Record<BrandLogoSize, string> = {
  chip: "text-[8px]",
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-[12px]",
  rail: "text-[11px]",
};

type BrandLogoImageProps = {
  visual: BrandVisual;
  size: BrandLogoSize;
  alt: string;
  priority?: boolean;
};

export function BrandLogoImage({ visual, size, alt, priority = false }: BrandLogoImageProps) {
  const [failed, setFailed] = useState(false);

  if (!visual.logo || failed) {
    return (
      <span
        className={`font-bold tracking-tight ${monogramSize[size]}`}
        style={{ color: visual.accent }}
      >
        {visual.monogram}
      </span>
    );
  }

  const frame = LOGO_FRAME[size];
  const intrinsic = visual.logoIntrinsic ?? { width: 512, height: 256 };
  const fitted = fitLogoInFrame(intrinsic, frame, visual.logoScale);

  return (
    <Image
      src={visual.logo}
      alt={alt}
      width={intrinsic.width}
      height={intrinsic.height}
      unoptimized
      priority={priority}
      onError={() => setFailed(true)}
      className="block object-contain object-center"
      style={{
        width: fitted.width,
        height: fitted.height,
        maxWidth: "100%",
        maxHeight: "100%",
        filter: "drop-shadow(0 1px 0 rgba(26,26,26,0.04))",
      }}
    />
  );
}
