import { isSafeAssetUrl } from "@/lib/render/protocol";
import { resolveRiskLevelFromStars } from "./risk-level";
import type { NegativeReviewAlertData } from "./types";

/**
 * Validación ESTRICTA del cuerpo de `POST /api/generate-negative-review-image` (SEC-006).
 *
 * A diferencia de `normalizeAlertPayload` (que completa lo que falta con datos de ejemplo y solo sirve para
 * `/preview` y desarrollo), aquí una petición real debe traer todos los campos obligatorios con el tipo y el
 * tamaño correctos. Lo que no se reconoce se descarta (nunca llega al renderer) y lo que falta o excede un
 * límite se rechaza. `risk_level` no se acepta del cliente: se recalcula desde las estrellas.
 */

export type AlertPayloadResult =
  | { ok: true; data: NegativeReviewAlertData }
  | { ok: false; field: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Límites de longitud (en caracteres). La reseña de Google admite hasta 4096. */
export const ALERT_LIMITS = {
  short: 200,
  address: 400,
  comment: 5000,
  long: 2000,
  reasons: 20,
  maxKeys: 60,
} as const;

type Checker = (value: unknown) => boolean;

const text = (max: number): Checker => (value) => typeof value === "string" && value.length <= max;
const nullableText = (max: number): Checker => (value) => value === null || text(max)(value);
const numberIn = (min: number, max: number): Checker => (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const intIn = (min: number, max: number): Checker => (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const nullable = (check: Checker): Checker => (value) => value === null || check(value);
const url: Checker = (value) => typeof value === "string" && isSafeAssetUrl(value);
const reasons: Checker = (value) =>
  Array.isArray(value) && value.length <= ALERT_LIMITS.reasons && value.every((item) => text(ALERT_LIMITS.short)(item));

const REQUIRED: Record<string, Checker> = {
  brand_name: text(ALERT_LIMITS.short),
  brand_logo_url: url,
  restaurant_name: text(ALERT_LIMITS.short),
  restaurant_location: text(ALERT_LIMITS.short),
  restaurant_address: text(ALERT_LIMITS.address),
  review_author: text(ALERT_LIMITS.short),
  review_date: text(60),
  review_time: text(60),
  review_stars: intIn(1, 5),
  review_comment: text(ALERT_LIMITS.comment),
  previous_rating: numberIn(0, 5),
  current_rating: numberIn(0, 5),
  rating_impact: numberIn(-5, 5),
  source: text(ALERT_LIMITS.short),
  detected_reasons: reasons,
  sentiment: text(ALERT_LIMITS.short),
  recommendation: text(ALERT_LIMITS.long),
  nexo_logo_url: url,
};

const OPTIONAL: Record<string, Checker> = {
  brand: text(40),
  ai_summary: nullableText(ALERT_LIMITS.long),
  analisis_pending: (value) => typeof value === "boolean",
  report_date: text(100),
  aspect_ratio: (value) => value === "4:3" || value === "9:16",
  review_count: nullable(intIn(0, 10_000_000)),
  lifetime_rating: nullable(numberIn(0, 5)),
  target_rating: numberIn(0, 5),
  main_motive: nullableText(ALERT_LIMITS.address),
  detected_impact: nullableText(ALERT_LIMITS.long),
  employee_mentioned: nullableText(ALERT_LIMITS.short),
  period_label: nullableText(ALERT_LIMITS.short),
  weekly_period_label: nullableText(ALERT_LIMITS.short),
  weekly_reviews_before: nullable(intIn(0, 10_000_000)),
  weekly_reviews_after: nullable(intIn(0, 10_000_000)),
  weekly_media_before: nullable(numberIn(0, 5)),
  weekly_media_after: nullable(numberIn(0, 5)),
};

export function validateAlertPayload(input: unknown): AlertPayloadResult {
  if (!isRecord(input)) return { ok: false, field: "body" };
  if (Object.keys(input).length > ALERT_LIMITS.maxKeys) return { ok: false, field: "body" };

  const out: Record<string, unknown> = {};

  for (const [key, check] of Object.entries(REQUIRED)) {
    const value = input[key];
    if (value === undefined || value === null || !check(value)) return { ok: false, field: key };
    out[key] = value;
  }
  for (const [key, check] of Object.entries(OPTIONAL)) {
    const value = input[key];
    if (value === undefined) continue;
    if (!check(value)) return { ok: false, field: key };
    out[key] = value;
  }

  // Nunca del cliente: el nivel de riesgo sale de las estrellas.
  out.risk_level = resolveRiskLevelFromStars(out.review_stars as number);
  return { ok: true, data: out as unknown as NegativeReviewAlertData };
}
