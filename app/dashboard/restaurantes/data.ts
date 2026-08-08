export type BrandId = "bk" | "pp" | "sg" | "ribs" | "tv" | "sibuya" | "th" | "vault";

/** Catálogo de marcas para filtros UI (nombres alineados con tabla `marcas` en Supabase). */
export const brands: { id: BrandId; name: string }[] = [
  { id: "bk", name: "Burger King" },
  { id: "pp", name: "Popeyes" },
  { id: "sg", name: "Santa Gloria" },
  { id: "th", name: "Tim Hortons" },
  { id: "ribs", name: "Ribs" },
  { id: "sibuya", name: "Sibuya" },
  { id: "tv", name: "Volapié" },
  { id: "vault", name: "Vault" },
];
