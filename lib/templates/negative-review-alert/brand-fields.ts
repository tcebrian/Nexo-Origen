import { brands, type BrandId } from "@/app/dashboard/restaurantes/data";
import { tenant } from "@/app/dashboard/tenant";
import {
  ALL_BRANDS_VISUAL,
  BRAND_VISUALS,
  fitLogoInFrame,
  type LogoFrameSpec,
} from "@/lib/restaurants/brand-visuals";
import type { NegativeReviewAlertData } from "./types";

/** Logos reales alineados con `BRAND_VISUALS` del dashboard. */
const TEMPLATE_BRAND_LOGO_OVERRIDES: Partial<Record<BrandId, string>> = {};

const SIDEBAR_LOGO_FRAME: LogoFrameSpec = {
  width: 148,
  height: 136,
  padding: 0,
  radius: "0",
};

function findVisualByLogo(logoUrl: string) {
  if (ALL_BRANDS_VISUAL.logo === logoUrl) return ALL_BRANDS_VISUAL;
  return Object.values(BRAND_VISUALS).find((visual) => visual.logo === logoUrl);
}

export function resolveSidebarLogoSize(
  logoUrl: string
): { width: number; height: number } | null {
  const visual = findVisualByLogo(logoUrl);
  if (!visual?.logoIntrinsic) return null;
  return fitLogoInFrame(visual.logoIntrinsic, SIDEBAR_LOGO_FRAME, visual.logoScale);
}

export function resolveAlertBrandLogo(brand: BrandId): string {
  return (
    TEMPLATE_BRAND_LOGO_OVERRIDES[brand] ??
    BRAND_VISUALS[brand]?.logo ??
    "/brands/burger-king-transparent.png"
  );
}

export function resolveAlertBrandName(brand: BrandId): string {
  return brands.find((b) => b.id === brand)?.name ?? brand;
}

export function applyBrandToAlertData(
  data: NegativeReviewAlertData,
  selected: "todas" | BrandId
): NegativeReviewAlertData {
  if (selected === "todas") {
    return {
      ...data,
      brand_name: tenant.name,
      brand_logo_url: tenant.logo ?? ALL_BRANDS_VISUAL.logo ?? data.brand_logo_url,
    };
  }

  return {
    ...data,
    brand_name: resolveAlertBrandName(selected),
    brand_logo_url: resolveAlertBrandLogo(selected),
  };
}
