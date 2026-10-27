import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { hasPngSignature } from "@/lib/conversations/report-adapters";
import { resolveCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";

/**
 * Condiciones que debe cumplir una alerta de reseña negativa ANTES de generar y enviar la imagen.
 * Núcleo puro (sin Supabase ni Next): `build-alert-for-resena.ts` lo usa para esperar al análisis IA y
 * `process.server.ts` para validar el PNG final. Si algo falta, se lanza `AlertNotReadyError`: la alerta
 * NO se envía incompleta y queda en cola para reintentarse (nunca se inventa un análisis).
 */

export type AlertNotReadyCode = "analysis_pending" | "incomplete_data" | "invalid_image" | "invalid_scope";

export class AlertNotReadyError extends Error {
  constructor(
    readonly code: AlertNotReadyCode,
    readonly fields: readonly string[] = []
  ) {
    super(`negative-alert not ready: ${code}${fields.length ? ` (${fields.join(", ")})` : ""}`);
    this.name = "AlertNotReadyError";
  }
}

/** Máximo que admite el envío de imágenes (mismo límite que los informes). */
export const MAX_ALERT_IMAGE_BYTES = 5 * 1024 * 1024;

const EMPTY_TOKENS = new Set(["", "--", "-", ".", "/", "n/a", "na", "null", "empty", "ninguno", "sin análisis ia", "sin analisis ia", "sin datos"]);

/** `true` si el texto trae contenido real (no vacío ni un marcador de "sin datos"). */
export function hasRealText(value: string | null | undefined): value is string {
  if (value == null) return false;
  const trimmed = value.trim();
  return !EMPTY_TOKENS.has(trimmed.toLowerCase()) && trimmed !== IA_NO_DATA;
}

/** Campos de `analisis_ia` que la plantilla necesita. `motivo` y `riesgo` se calculan por reglas, no se exigen. */
const REQUIRED_ANALYSIS_FIELDS = ["resumen", "impacto", "recomendacion", "sentimiento"] as const;

export function missingAnalysisFields(analisis: Partial<AnalisisIaRow> | null | undefined): string[] {
  if (!analisis) return [...REQUIRED_ANALYSIS_FIELDS];
  return REQUIRED_ANALYSIS_FIELDS.filter((field) => !hasRealText(analisis[field]));
}

export function isAnalysisComplete(analisis: Partial<AnalisisIaRow> | null | undefined): boolean {
  return missingAnalysisFields(analisis).length === 0;
}

export type WaitForAnalysisOptions = {
  timeoutMs: number;
  intervalMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/**
 * Espera a que el análisis IA esté COMPLETO. La reseña dispara la alerta al insertarse y el análisis lo
 * escribe otro proceso (Make) unos segundos después: leerlo una sola vez es una condición de carrera.
 * Devuelve el análisis completo o lanza `analysis_pending` al agotar el tiempo.
 */
export async function waitForCompleteAnalysis(
  load: () => Promise<AnalisisIaRow | null>,
  options: WaitForAnalysisOptions
): Promise<AnalisisIaRow> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let missing: string[] = [...REQUIRED_ANALYSIS_FIELDS];

  for (;;) {
    const analisis = await load();
    missing = missingAnalysisFields(analisis);
    if (analisis && missing.length === 0) return analisis;
    if (now() + options.intervalMs > deadline) break;
    await sleep(options.intervalMs);
  }
  throw new AlertNotReadyError("analysis_pending", missing);
}

/**
 * Campos que la plantilla muestra como secciones y que no pueden llegar vacíos a una alerta real.
 * `requireAnalysis: false` solo para reseñas SIN texto (solo estrellas): no hay nada que analizar.
 */
export function missingAlertFields(data: NegativeReviewAlertData, options: { requireAnalysis?: boolean } = {}): string[] {
  const requireAnalysis = options.requireAnalysis ?? true;
  const missing: string[] = [];
  const text: [string, string | null | undefined][] = [
    ["review_author", data.review_author],
    ["review_comment", data.review_comment],
    ["restaurant_name", data.restaurant_name],
    ["brand_name", data.brand_name],
    ["risk_level", data.risk_level],
  ];
  if (requireAnalysis) {
    text.push(
      ["ai_summary", data.ai_summary],
      ["main_motive", data.main_motive],
      ["detected_impact", data.detected_impact],
      ["recommendation", data.recommendation],
      ["sentiment", data.sentiment]
    );
  }
  for (const [field, value] of text) if (!hasRealText(value)) missing.push(field);

  const numbers: [string, number][] = [
    ["previous_rating", data.previous_rating],
    ["current_rating", data.current_rating],
    ["rating_impact", data.rating_impact],
  ];
  for (const [field, value] of numbers) if (!Number.isFinite(value)) missing.push(field);

  if (!(data.review_stars >= 1 && data.review_stars <= 5)) missing.push("review_stars");
  if (!data.brand) missing.push("brand");
  return missing;
}

export function assertAlertDataComplete(data: NegativeReviewAlertData, options: { requireAnalysis?: boolean } = {}): void {
  const missing = missingAlertFields(data, options);
  if (missing.length > 0) throw new AlertNotReadyError("incomplete_data", missing);
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** El PNG final debe ser un PNG, tener el tamaño de entrega de su formato y caber en el límite de envío. */
export function assertValidAlertPng(bytes: Uint8Array, aspectRatio: "4:3" | "9:16" = "4:3"): void {
  if (!hasPngSignature(bytes) || bytes.length > MAX_ALERT_IMAGE_BYTES) throw new AlertNotReadyError("invalid_image", ["png"]);
  const target = resolveCanvasSize(aspectRatio);
  const size = pngDimensions(bytes);
  if (!size || size.width !== target.width || size.height !== target.height) {
    throw new AlertNotReadyError("invalid_image", ["dimensions"]);
  }
}
