import { NEXO_ORIGEN_LOGO_SRC } from "@/app/_components/nexo-brand";
import { resolveAlertBrandLogo } from "@/lib/templates/negative-review-alert/brand-fields";
import { resolveRiskLevelFromStars } from "@/lib/templates/negative-review-alert/risk-level";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import type { Review } from "@/lib/reviews/types";

function formatAlertDateTime(date: Date): {
  review_date: string;
  review_time: string;
  report_date: string;
} {
  if (Number.isNaN(date.getTime())) {
    return { review_date: "—", review_time: "—", report_date: "—" };
  }

  const review_date = date
    .toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\./g, "")
    .toUpperCase();
  const review_time = date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const report_date = date
    .toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\./g, "")
    .toUpperCase();

  return { review_date, review_time, report_date };
}

function stripPostalPrefix(value: string): string {
  return value
    .replace(/^[A-Z]{1,2}-?\d{4,5}\s+/i, "")
    .replace(/^\d{4,5}\s+/, "")
    .trim();
}

/** "Av. Zaragoza, s/n, 50180 Utebo, Zaragoza" -> "Utebo, Zaragoza" */
function resolveShortLocation(location: string | undefined): string {
  const address = location?.trim() ?? "";
  if (!address) return "—";

  const segments = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const countryOrRegion = segments[segments.length - 1] ?? "";
    const previous = stripPostalPrefix(segments[segments.length - 2] ?? "");
    return previous ? `${previous}, ${countryOrRegion}` : `${segments[segments.length - 2]}, ${countryOrRegion}`;
  }
  return segments[0] ?? "—";
}

/**
 * Para Burger King, el título de la imagen es "BK {localidad}" — pero la
 * localidad NO se saca de la dirección (texto libre; a veces solo trae la
 * provincia, ej. "Zaragoza", no el pueblo exacto — así salió mal "BK
 * Zaragoza" en vez de "BK Calatayud" para una reseña de Calatayud). Se saca
 * del propio nombre del restaurante en el catálogo (ej. "BK Calatayud"),
 * que sí es siempre la localidad exacta — solo hay que quitarle el prefijo
 * de marca.
 */
function resolveRestaurantTitle(review: Review): string {
  if (review.brand === "bk") {
    const city = review.restaurant.replace(/^\s*(bk|burger\s*king)\s+/i, "").trim();
    return city ? `BK ${city}`.toUpperCase() : review.restaurant.toUpperCase();
  }
  return review.restaurant.toUpperCase();
}

/**
 * Igual que `mapReportRowToAlertData` pero partiendo de un `Review` de la
 * bandeja general (cualquier nota, no solo negativas ≤3★) en vez de una fila
 * del informe de reseñas negativas — esa fuente ya trae datos que aquí no
 * están disponibles (total histórico, media global del local), por eso
 * `review_count`/`lifetime_rating` se omiten: la plantilla los trata como
 * opcionales y sencillamente no muestra el bloque de objetivo que dependía
 * de ellos.
 */
export function mapReviewToAlertData(review: Review): NegativeReviewAlertData {
  const { review_date, review_time, report_date } = formatAlertDateTime(review.date);
  const previous = review.mediaBefore ?? review.mediaAfter ?? 0;
  const current = review.mediaAfter ?? review.mediaBefore ?? 0;
  const impact =
    review.mediaImpact ??
    (review.mediaBefore != null && review.mediaAfter != null ? review.mediaAfter - review.mediaBefore : 0);

  return {
    brand: review.brand,
    brand_name: review.brandLabel,
    brand_logo_url: resolveAlertBrandLogo(review.brand),
    restaurant_name: resolveRestaurantTitle(review),
    restaurant_location: resolveShortLocation(review.location),
    restaurant_address: review.location ?? "—",
    review_author: review.author,
    review_date,
    review_time,
    review_stars: review.rating,
    review_comment: review.text,
    previous_rating: previous,
    current_rating: current,
    rating_impact: impact,
    risk_level: resolveRiskLevelFromStars(review.rating),
    source: "Google Maps",
    detected_reasons: review.motiveLabel ? [review.motiveLabel] : [],
    sentiment: review.sentimentLabel,
    recommendation: review.recommendedAction,
    ai_summary: review.ai?.summary ?? null,
    analisis_pending: review.iaPending,
    main_motive: review.motiveLabel,
    detected_impact: review.impactLabel,
    employee_mentioned: review.employeeMentioned,
    nexo_logo_url: NEXO_ORIGEN_LOGO_SRC,
    report_date,
    aspect_ratio: "4:3",
  };
}
