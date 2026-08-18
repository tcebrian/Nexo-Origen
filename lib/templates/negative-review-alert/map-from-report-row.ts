import { NEXO_ORIGEN_LOGO_SRC } from "@/app/_components/nexo-brand";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { resolveAlertBrandLogo } from "@/lib/templates/negative-review-alert/brand-fields";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { resolveCityLabel } from "@/lib/reports/negative-reviews/templates/resolve-local";
import { resolveRiskLevelFromStars } from "@/lib/templates/negative-review-alert/risk-level";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";

function formatAlertDateTime(dateIso: string): {
  review_date: string;
  review_time: string;
  report_date: string;
} {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return {
      review_date: "—",
      review_time: "—",
      report_date: "—",
    };
  }

  const review_date = parsed
    .toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\./g, "")
    .toUpperCase();
  const review_time = parsed.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const report_date = parsed
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

function resolveShortLocation(row: NegativeReviewReportRow): string {
  const address = row.address?.trim() ?? "";
  if (address && address !== "—") {
    const segments = address.split(",").map((part) => part.trim()).filter(Boolean);
    if (segments.length >= 2) {
      const countryOrRegion = segments[segments.length - 1] ?? "";
      const previous = stripPostalPrefix(segments[segments.length - 2] ?? "");
      if (previous) {
        return `${previous}, ${countryOrRegion}`;
      }
      return `${segments[segments.length - 2]}, ${countryOrRegion}`;
    }
  }

  const city = row.city?.trim();
  if (city) {
    const normalized = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    return normalized;
  }

  const label = resolveCityLabel(row);
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function resolveRestaurantTitle(row: NegativeReviewReportRow): string {
  const city = resolveCityLabel(row);
  if (row.brand === "bk") {
    const label = city
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
    return `BK ${label}`.toUpperCase();
  }
  return row.restaurant.toUpperCase();
}

function resolveBrandLogo(brand: BrandId): string {
  return resolveAlertBrandLogo(brand);
}

export function mapReportRowToAlertData(row: NegativeReviewReportRow): NegativeReviewAlertData {
  const { review_date, review_time, report_date } = formatAlertDateTime(row.dateIso);
  const previous = row.mediaBefore ?? row.mediaAfter ?? 0;
  const current = row.mediaAfter ?? row.mediaBefore ?? 0;
  const impact =
    row.impact ?? (row.mediaBefore != null && row.mediaAfter != null ? row.mediaAfter - row.mediaBefore : 0);

  const detectedReasons = row.detectedReasons.filter((reason) => reason !== IA_NO_DATA);

  return {
    brand: row.brand,
    brand_name: row.brandLabel,
    brand_logo_url: resolveBrandLogo(row.brand),
    restaurant_name: resolveRestaurantTitle(row),
    restaurant_location: resolveShortLocation(row),
    restaurant_address: row.address,
    review_author: row.author,
    review_date,
    review_time,
    review_stars: row.stars,
    review_comment: row.comment,
    previous_rating: previous,
    current_rating: current,
    rating_impact: impact,
    risk_level: resolveRiskLevelFromStars(row.stars),
    source: "Google Maps",
    detected_reasons: detectedReasons,
    sentiment: row.sentiment,
    recommendation: row.recommendation,
    ai_summary: row.aiSummary,
    analisis_pending: row.analisisPending,
    main_motive: row.motive,
    detected_impact: row.impactText,
    employee_mentioned: row.employeeMentioned,
    nexo_logo_url: NEXO_ORIGEN_LOGO_SRC,
    report_date,
    aspect_ratio: "4:3",
    review_count: row.totalReviews,
    lifetime_rating: row.lifetimeMedia,
  };
}
