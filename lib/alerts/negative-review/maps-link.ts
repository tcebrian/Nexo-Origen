/**
 * Enlace de Google Maps de una alerta negativa. Función pura.
 *
 * Prioridad:
 *   1. URL EXACTA de la reseña (`resenas.url`), solo si es de verdad un enlace a una reseña
 *      (`/maps/reviews/…`). Hoy el ~99 % de `resenas.url` es el PERFIL del autor (`/maps/contrib/…`):
 *      nunca se envía, ni como enlace ni como dato.
 *   2. `restaurantes.google_maps_url`, si está informado.
 *   3. Enlace oficial de Maps URLs construido con `place_id` (o con `cid` si algún día existe).
 *   4. Respaldo: búsqueda de Maps con nombre + dirección.
 * Solo se aceptan URLs `https` de dominios de Google Maps.
 */

export type MapsLinkSource = "review_url" | "google_maps_url" | "place_id" | "cid" | "search";

export type MapsLinkInput = {
  reviewUrl?: string | null;
  restaurantMapsUrl?: string | null;
  placeId?: string | null;
  cid?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
};

const GOOGLE_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com", "www.google.es", "google.es", "maps.app.goo.gl", "goo.gl", "g.page"]);

function parseGoogleUrl(value: string | null | undefined): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !GOOGLE_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

/** ¿Es un enlace a una RESEÑA concreta (no al perfil del autor)? */
export function isReviewUrl(value: string | null | undefined): boolean {
  const url = parseGoogleUrl(value);
  if (!url) return false;
  const path = url.pathname.toLowerCase();
  if (path.includes("/maps/contrib/")) return false;
  return path.includes("/maps/reviews/");
}

function isMapsPlaceUrl(value: string | null | undefined): boolean {
  const url = parseGoogleUrl(value);
  if (!url) return false;
  if (url.pathname.toLowerCase().includes("/maps/contrib/")) return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host === "goo.gl" || host === "g.page") return true;
  return url.pathname.toLowerCase().startsWith("/maps") || host === "maps.google.com";
}

export function resolveMapsLink(input: MapsLinkInput): { url: string; source: MapsLinkSource } | null {
  if (isReviewUrl(input.reviewUrl)) return { url: input.reviewUrl!.trim(), source: "review_url" };
  if (isMapsPlaceUrl(input.restaurantMapsUrl)) return { url: input.restaurantMapsUrl!.trim(), source: "google_maps_url" };

  const placeId = input.placeId?.trim();
  if (placeId) {
    return {
      url: `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`,
      source: "place_id",
    };
  }
  const cid = input.cid?.trim();
  if (cid && /^\d{5,25}$/.test(cid)) return { url: `https://www.google.com/maps?cid=${cid}`, source: "cid" };

  const query = [input.name, input.address, input.city].map((part) => part?.trim()).filter(Boolean).join(" ");
  if (query) {
    return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, source: "search" };
  }
  return null;
}
