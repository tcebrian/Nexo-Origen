import type { AlertAspectRatio, NegativeReviewAlertData } from "./types";
import { resolveRiskLevelFromStars } from "./risk-level";

function parseNumber(value: string | null | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStars(value: string | null | undefined, fallback: number): number {
  const stars = Math.round(parseNumber(value, fallback));
  return Math.max(1, Math.min(5, stars));
}

function parseReasons(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
  } catch {
    return value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseAspectRatio(value: string | null | undefined): AlertAspectRatio {
  return value === "9:16" ? "9:16" : "4:3";
}

export function parseAlertFromSearchParams(
  params: URLSearchParams,
  fallback: NegativeReviewAlertData
): NegativeReviewAlertData {
  const get = (key: keyof NegativeReviewAlertData) => params.get(key) ?? undefined;
  const review_stars = parseStars(get("review_stars"), fallback.review_stars);

  return {
    brand: get("brand") ?? fallback.brand,
    brand_name: get("brand_name") ?? fallback.brand_name,
    brand_logo_url: get("brand_logo_url") ?? fallback.brand_logo_url,
    restaurant_name: get("restaurant_name") ?? fallback.restaurant_name,
    restaurant_location: get("restaurant_location") ?? fallback.restaurant_location,
    restaurant_address: get("restaurant_address") ?? fallback.restaurant_address,
    review_author: get("review_author") ?? fallback.review_author,
    review_date: get("review_date") ?? fallback.review_date,
    review_time: get("review_time") ?? fallback.review_time,
    review_stars,
    review_comment: get("review_comment") ?? fallback.review_comment,
    previous_rating: parseNumber(get("previous_rating"), fallback.previous_rating),
    current_rating: parseNumber(get("current_rating"), fallback.current_rating),
    rating_impact: parseNumber(get("rating_impact"), fallback.rating_impact),
    risk_level: resolveRiskLevelFromStars(review_stars),
    source: get("source") ?? fallback.source,
    detected_reasons: parseReasons(get("detected_reasons")) || fallback.detected_reasons,
    sentiment: get("sentiment") ?? fallback.sentiment,
    recommendation: get("recommendation") ?? fallback.recommendation,
    nexo_logo_url: get("nexo_logo_url") ?? fallback.nexo_logo_url,
    report_date: get("report_date") ?? fallback.report_date,
    aspect_ratio: parseAspectRatio(get("aspect_ratio")),
    review_count:
      get("review_count") != null && get("review_count") !== ""
        ? parseNumber(get("review_count"), fallback.review_count ?? 0)
        : fallback.review_count,
    lifetime_rating:
      get("lifetime_rating") != null && get("lifetime_rating") !== ""
        ? parseNumber(get("lifetime_rating"), fallback.lifetime_rating ?? 0)
        : fallback.lifetime_rating,
    target_rating: parseNumber(get("target_rating"), fallback.target_rating ?? 4.4),
    main_motive: get("main_motive") ?? fallback.main_motive,
    detected_impact: get("detected_impact") ?? fallback.detected_impact,
    employee_mentioned: get("employee_mentioned") ?? fallback.employee_mentioned,
    period_label: get("period_label") ?? fallback.period_label,
  };
}

export function normalizeAlertPayload(
  input: Partial<NegativeReviewAlertData> | null | undefined,
  fallback: NegativeReviewAlertData
): NegativeReviewAlertData {
  if (!input) return fallback;

  const review_stars = parseStars(String(input.review_stars ?? fallback.review_stars), fallback.review_stars);

  return {
    brand: input.brand ?? fallback.brand,
    brand_name: input.brand_name ?? fallback.brand_name,
    brand_logo_url: input.brand_logo_url ?? fallback.brand_logo_url,
    restaurant_name: input.restaurant_name ?? fallback.restaurant_name,
    restaurant_location: input.restaurant_location ?? fallback.restaurant_location,
    restaurant_address: input.restaurant_address ?? fallback.restaurant_address,
    review_author: input.review_author ?? fallback.review_author,
    review_date: input.review_date ?? fallback.review_date,
    review_time: input.review_time ?? fallback.review_time,
    review_stars,
    review_comment: input.review_comment ?? fallback.review_comment,
    previous_rating: parseNumber(String(input.previous_rating ?? fallback.previous_rating), fallback.previous_rating),
    current_rating: parseNumber(String(input.current_rating ?? fallback.current_rating), fallback.current_rating),
    rating_impact: parseNumber(String(input.rating_impact ?? fallback.rating_impact), fallback.rating_impact),
    risk_level: resolveRiskLevelFromStars(review_stars),
    source: input.source ?? fallback.source,
    detected_reasons:
      Array.isArray(input.detected_reasons) && input.detected_reasons.length > 0
        ? input.detected_reasons.map(String)
        : fallback.detected_reasons,
    sentiment: input.sentiment ?? fallback.sentiment,
    recommendation: input.recommendation ?? fallback.recommendation,
    nexo_logo_url: input.nexo_logo_url ?? fallback.nexo_logo_url,
    report_date: input.report_date ?? fallback.report_date,
    aspect_ratio: input.aspect_ratio === "9:16" ? "9:16" : fallback.aspect_ratio ?? "4:3",
    review_count: input.review_count ?? fallback.review_count,
    lifetime_rating: input.lifetime_rating ?? fallback.lifetime_rating,
    target_rating: input.target_rating ?? fallback.target_rating,
    main_motive: input.main_motive ?? fallback.main_motive,
    detected_impact: input.detected_impact ?? fallback.detected_impact,
    employee_mentioned: input.employee_mentioned ?? fallback.employee_mentioned,
    period_label: input.period_label ?? fallback.period_label,
  };
}

export function buildAlertTemplateUrl(
  data: NegativeReviewAlertData,
  assetBaseUrl: string
): string {
  const params = new URLSearchParams();
  const entries = Object.entries(data) as [keyof NegativeReviewAlertData, NegativeReviewAlertData[keyof NegativeReviewAlertData]][];

  for (const [key, value] of entries) {
    if (value == null || value === "") continue;
    if (key === "detected_reasons" && Array.isArray(value)) {
      params.set(key, JSON.stringify(value));
      continue;
    }
    params.set(key, String(value));
  }

  const base = assetBaseUrl.replace(/\/$/, "");
  return `${base}/templates/negative-review-alert?${params.toString()}`;
}
