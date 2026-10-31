/**
 * Nombre de un restaurante con su marca delante ("Santa Gloria Caleido"), sin repetirla.
 * No se antepone si el nombre ya contiene la marca ni si ya empieza por su abreviatura (iniciales:
 * "BK Utebo" para "Burger King"), para evitar "Burger King BK Utebo".
 */
export function qualifyRestaurantName(brand: string, name: string): string {
  const cleanBrand = brand.trim();
  if (!cleanBrand) return name;
  const lowerName = name.toLowerCase();
  if (lowerName.includes(cleanBrand.toLowerCase())) return name;

  const initials = cleanBrand
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .toLowerCase();
  if (initials.length >= 2 && (lowerName === initials || lowerName.startsWith(`${initials} `))) return name;

  return `${cleanBrand} ${name}`;
}
