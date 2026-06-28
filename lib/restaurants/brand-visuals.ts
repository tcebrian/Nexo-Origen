import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type BrandLogoSize = "chip" | "xs" | "sm" | "md" | "lg" | "rail";

/** Marco exterior fijo por tamaño — proporción horizontal para logos de cadena. */
export type LogoFrameSpec = {
  width: number;
  height: number;
  padding: number;
  radius: string;
};

export const LOGO_FRAME: Record<BrandLogoSize, LogoFrameSpec> = {
  chip: { width: 58, height: 24, padding: 3, radius: "rounded-md" },
  xs: { width: 76, height: 30, padding: 4, radius: "rounded-lg" },
  sm: { width: 92, height: 36, padding: 5, radius: "rounded-lg" },
  md: { width: 108, height: 42, padding: 5, radius: "rounded-xl" },
  lg: { width: 132, height: 50, padding: 6, radius: "rounded-xl" },
  rail: { width: 120, height: 46, padding: 6, radius: "rounded-xl" },
};

/** Tamaños unificados para logos sobre fondo oscuro (sin marco blanco). */
export const SHARED_BRAND_LOGO_SIZES: Record<BrandLogoSize, string> = {
  chip: "max-h-[18px] max-w-[52px] w-auto",
  xs: "max-h-7 max-w-[76px] w-auto",
  sm: "max-h-9 max-w-[100px] w-auto",
  md: "max-h-11 max-w-[120px] w-auto",
  lg: "max-h-14 max-w-[150px] w-auto",
  rail: "max-h-11 max-w-[120px] w-auto",
};

export const BRAND_RAIL_LOGO_BOX = "flex w-[120px] items-center justify-center";

export type BrandVisual = {
  monogram: string;
  logo?: string;
  logoIntrinsic?: { width: number; height: number };
  /** Ajuste fino dentro del marco (logos muy anchos o compactos). */
  logoScale: number;
  accent: string;
  tileBg: string;
  tileBorder: string;
  glow: string;
  gradient: string;
  ring: string;
};

export const BRAND_VISUALS: Record<BrandId, BrandVisual> = {
  bk: {
    monogram: "BK",
    logo: "/brands/burger-king-transparent.png",
    logoIntrinsic: { width: 520, height: 463 },
    logoScale: 0.92,
    accent: "#D62300",
    tileBg: "#FFF8F5",
    tileBorder: "#FED7AA",
    glow: "rgba(214,35,0,0.12)",
    gradient: "from-orange-50 to-white",
    ring: "ring-orange-200",
  },
  pp: {
    monogram: "PP",
    logo: "/brands/popeyes-transparent.png",
    logoIntrinsic: { width: 698, height: 357 },
    logoScale: 0.96,
    accent: "#F27C0D",
    tileBg: "#FFFBF5",
    tileBorder: "#FDE68A",
    glow: "rgba(242,124,13,0.12)",
    gradient: "from-amber-50 to-white",
    ring: "ring-amber-200",
  },
  sg: {
    monogram: "SG",
    logo: "/brands/santa-gloria-transparent.png",
    logoIntrinsic: { width: 801, height: 509 },
    logoScale: 0.94,
    accent: "#9A6B3F",
    tileBg: "#FDFAF6",
    tileBorder: "#E7D5C4",
    glow: "rgba(154,107,63,0.1)",
    gradient: "from-stone-50 to-white",
    ring: "ring-stone-200",
  },
  ribs: {
    monogram: "RB",
    logo: "/brands/ribs-transparent.png",
    logoIntrinsic: { width: 673, height: 412 },
    logoScale: 0.94,
    accent: "#B8432A",
    tileBg: "#FFF8F6",
    tileBorder: "#FECACA",
    glow: "rgba(184,67,42,0.1)",
    gradient: "from-red-50 to-white",
    ring: "ring-red-200",
  },
  tv: {
    monogram: "TV",
    logo: "/brands/taberna-volapie-transparent.png",
    logoIntrinsic: { width: 478, height: 159 },
    logoScale: 0.98,
    accent: "#5C6B3A",
    tileBg: "#F8FAF4",
    tileBorder: "#D9E2C5",
    glow: "rgba(92,107,58,0.1)",
    gradient: "from-lime-50 to-white",
    ring: "ring-lime-200",
  },
  sibuya: {
    monogram: "SY",
    logo: "/brands/sibuya-transparent.png",
    logoIntrinsic: { width: 370, height: 359 },
    logoScale: 0.88,
    accent: "#5C5348",
    tileBg: "#FAF9F7",
    tileBorder: "#E5E0D8",
    glow: "rgba(92,83,72,0.08)",
    gradient: "from-stone-50 to-white",
    ring: "ring-stone-200",
  },
  th: {
    monogram: "TH",
    logo: "/brands/tim-hortons-transparent.png",
    logoIntrinsic: { width: 869, height: 491 },
    logoScale: 0.95,
    accent: "#C8102E",
    tileBg: "#FFF6F8",
    tileBorder: "#FECDD3",
    glow: "rgba(200,16,46,0.1)",
    gradient: "from-rose-50 to-white",
    ring: "ring-rose-200",
  },
};

export const ALL_BRANDS_VISUAL: BrandVisual = {
  monogram: "GH",
  logo: "/brands/grupo-hambar-transparent.png",
  logoIntrinsic: { width: 621, height: 404 },
  logoScale: 0.94,
  accent: "#6D28D9",
  tileBg: "#F8F5FF",
  tileBorder: "#DDD6FE",
  glow: "rgba(109,40,217,0.1)",
  gradient: "from-violet-50 to-white",
  ring: "ring-violet-200",
};

export function brandHasLogo(brand: BrandId) {
  return Boolean(BRAND_VISUALS[brand].logo);
}

/** Calcula dimensiones de imagen para encajar en el marco sin deformar. */
export function fitLogoInFrame(
  intrinsic: { width: number; height: number },
  frame: LogoFrameSpec,
  scale = 1
): { width: number; height: number } {
  const innerW = Math.max(1, frame.width - frame.padding * 2);
  const innerH = Math.max(1, frame.height - frame.padding * 2);
  const logoAspect = intrinsic.width / intrinsic.height;
  const frameAspect = innerW / innerH;

  let w: number;
  let h: number;

  if (logoAspect >= frameAspect) {
    w = innerW * scale;
    h = w / logoAspect;
    if (h > innerH * scale) {
      h = innerH * scale;
      w = h * logoAspect;
    }
  } else {
    h = innerH * scale;
    w = h * logoAspect;
    if (w > innerW * scale) {
      w = innerW * scale;
      h = w / logoAspect;
    }
  }

  return { width: Math.round(w), height: Math.round(h) };
}
