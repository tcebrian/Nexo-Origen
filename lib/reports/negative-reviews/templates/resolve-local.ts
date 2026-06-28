import type { NegativeReviewReportRow } from "../types";

/** Ciudad/local corto para la cabecera del informe (nunca la dirección completa). */
export function resolveCityLabel(
  input: Pick<NegativeReviewReportRow, "restaurant" | "city" | "address">
): string {
  const fromCatalog = input.city?.trim();
  if (fromCatalog && fromCatalog.length <= 28) {
    return fromCatalog.toUpperCase();
  }

  const fromRestaurant = extractFromRestaurantName(input.restaurant);
  if (fromRestaurant) return fromRestaurant;

  const fromAddress = extractFromAddress(input.address ?? "");
  if (fromAddress) return fromAddress;

  return fromCatalog?.slice(0, 22).toUpperCase() || "LOCAL";
}

function extractFromRestaurantName(name: string): string | null {
  const cleaned = name
    .replace(/burger\s*king/gi, "")
    .replace(/\bbk\b/gi, "")
    .replace(/pol\.?\s*ind\.?/gi, "")
    .trim();

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const last = parts[parts.length - 1];
  if (last.length >= 3 && last.length <= 22) {
    return last.toUpperCase();
  }

  return null;
}

function extractFromAddress(address: string): string | null {
  if (!address || address === "—") return null;

  const postalMatch = address.match(/\b\d{5}\s+([^,]+)/i);
  if (postalMatch) {
    return postalMatch[1].trim().toUpperCase();
  }

  const segments = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const beforeCountry = segments[segments.length - 2];
    if (beforeCountry.length >= 3 && beforeCountry.length <= 24) {
      return beforeCountry.toUpperCase();
    }
  }

  const first = segments[0];
  if (first && first.length >= 3 && first.length <= 24) {
    return first.toUpperCase();
  }

  return null;
}
