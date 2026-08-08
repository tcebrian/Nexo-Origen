import { brands, type BrandId } from "@/app/dashboard/restaurantes/data";

const MARCA_RULES: { pattern: RegExp; brand: BrandId }[] = [
  { pattern: /burger|^bk$/, brand: "bk" },
  { pattern: /popeyes|^pp$/, brand: "pp" },
  { pattern: /santa|gloria|^sg$/, brand: "sg" },
  { pattern: /tim|horton|^th$/, brand: "th" },
  { pattern: /ribs|^rb$/, brand: "ribs" },
  { pattern: /sibuya|^sy$/, brand: "sibuya" },
  { pattern: /volap|taberna|^tv$/, brand: "tv" },
  { pattern: /vault/, brand: "vault" },
];

/** Convierte nombre de marca de Supabase al id visual de la app. */
export function marcaToBrandId(marca: string): BrandId {
  const normalized = marca.trim().toLowerCase();
  if (!normalized || normalized === "otros") {
    return "bk";
  }

  for (const { pattern, brand } of MARCA_RULES) {
    if (pattern.test(normalized)) return brand;
  }

  for (const entry of brands) {
    const name = entry.name.toLowerCase();
    if (normalized.includes(name) || name.includes(normalized)) {
      return entry.id;
    }
  }

  return "bk";
}

type CatalogMarcaSource = {
  marca?: string | null;
  brand?: BrandId;
};

/**
 * Prioridad: catálogo KPI por restaurante_id → marca en reseña → heurística.
 */
export function resolveBrandId(
  restauranteId: number | null | undefined,
  marca: string | null | undefined,
  catalogById?: Map<number, CatalogMarcaSource> | ReadonlyMap<number, CatalogMarcaSource>
): BrandId {
  if (restauranteId != null && catalogById?.has(restauranteId)) {
    const entry = catalogById.get(restauranteId)!;
    if (entry.brand) return entry.brand;
    if (entry.marca?.trim()) return marcaToBrandId(entry.marca);
  }

  if (marca?.trim()) return marcaToBrandId(marca);

  return marcaToBrandId("");
}
