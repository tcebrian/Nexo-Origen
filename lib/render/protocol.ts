import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { MonthlyReportData } from "@/lib/reports/monthly/data";
import { isNetworkReportGroupId, type NetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { isReportPeriodSlug, type ReportPeriodSlug } from "@/lib/reports/period-ranges";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";

/**
 * Protocolo del renderer interno (`POST /api/internal/render`).
 *
 * Es la ÚNICA función que carga Chromium (playwright-core + @sparticuz/chromium), sharp y los assets
 * de las plantillas; el resto de rutas preparan los datos (auth, scope, permisos) y le piden la imagen
 * o el PDF. Este módulo solo tiene lo que comparten el cliente y el renderer: sin Chromium, sin sharp
 * y sin acceso a datos, para que las rutas públicas puedan importarlo sin arrastrar nada pesado.
 *
 * El renderer NO es genérico: acepta una lista CERRADA de operaciones con parámetros validados.
 * Nunca recibe una URL, un host ni un origen: el origen lo fija el servidor (`resolveInternalOrigin`).
 *
 * Autenticación: firma HMAC-SHA256 del cuerpo con `NEXO_INTERNAL_RENDER_TOKEN` como clave, más una marca de
 * tiempo (ventana de 60 s). El token nunca viaja por la red.
 */

export const RENDER_PATH = "/api/internal/render";
export const RENDER_TIMESTAMP_HEADER = "x-nexo-render-timestamp";
export const RENDER_SIGNATURE_HEADER = "x-nexo-render-signature";
/** Cabecera de Vercel para atravesar la Deployment Protection de un preview con la propia URL. */
export const VERCEL_BYPASS_HEADER = "x-vercel-protection-bypass";

export const RENDER_MAX_BODY_BYTES = 1_000_000;
export const RENDER_SIGNATURE_WINDOW_MS = 60_000;
/** Menor que el `maxDuration` de las rutas públicas (60 s): así el cliente falla antes que la función. */
export const RENDER_CLIENT_TIMEOUT_MS = 55_000;
const MIN_TOKEN_LENGTH = 16;

export const RENDER_OPERATIONS = [
  "monthly_pdf",
  "monthly_image",
  "negative_review_image",
  "network_summary_image",
  "whatsapp_alert_image",
] as const;
export type RenderOperation = (typeof RENDER_OPERATIONS)[number];

export type RenderRequest =
  | { op: "monthly_pdf" | "monthly_image"; report: MonthlyReportData }
  | { op: "negative_review_image" | "whatsapp_alert_image"; data: NegativeReviewAlertData }
  | { op: "network_summary_image"; periodo: ReportPeriodSlug; grupo: NetworkReportGroupId; offset: number };

export const RENDER_CONTENT_TYPES: Record<RenderOperation, "application/pdf" | "image/png"> = {
  monthly_pdf: "application/pdf",
  monthly_image: "image/png",
  negative_review_image: "image/png",
  network_summary_image: "image/png",
  whatsapp_alert_image: "image/png",
};

// Credencial y firma -------------------------------------------------------------------------

/** Credencial interna configurada, o `null` si falta o es demasiado débil. */
export function renderSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env.NEXO_INTERNAL_RENDER_TOKEN?.trim();
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

const sha256Hex = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

/** HMAC-SHA256(secret, `${timestamp}.${sha256(cuerpo)}`) en hexadecimal. */
export function signRenderBody(rawBody: Uint8Array, secret: string, timestampMs: number): string {
  return createHmac("sha256", secret).update(`${timestampMs}.${sha256Hex(rawBody)}`).digest("hex");
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing_secret" | "bad_timestamp" | "expired" | "bad_signature" };

/** Comprueba marca de tiempo (±60 s) y firma, en tiempo constante. */
export function verifyRenderSignature(input: {
  rawBody: Uint8Array;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  secret: string | null;
  nowMs: number;
}): SignatureCheck {
  if (!input.secret) return { ok: false, reason: "missing_secret" };
  if (!input.timestamp || !/^\d{10,16}$/.test(input.timestamp)) return { ok: false, reason: "bad_timestamp" };
  const timestamp = Number(input.timestamp);
  if (Math.abs(input.nowMs - timestamp) > RENDER_SIGNATURE_WINDOW_MS) return { ok: false, reason: "expired" };
  if (!input.signature || !/^[0-9a-f]{64}$/.test(input.signature)) return { ok: false, reason: "bad_signature" };

  const expected = Buffer.from(signRenderBody(input.rawBody, input.secret, timestamp), "hex");
  const provided = Buffer.from(input.signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

// Origen ---------------------------------------------------------------------------------------

/**
 * Origen del propio despliegue, fijado por el SERVIDOR (nunca por la petición). Lo usan el cliente (a quién
 * llamar) y el renderer (qué plantilla abrir y a qué origen deja salir a Chromium).
 *  - `NEXO_INTERNAL_ORIGIN`: forzado (http solo en localhost).
 *  - Producción de Vercel: el dominio de producción (la URL del despliegue está tras Deployment Protection).
 *  - Preview de Vercel: la URL del despliegue.
 *  - Local: http://localhost:PORT.
 */
export function resolveInternalOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const forced = env.NEXO_INTERNAL_ORIGIN?.trim();
  if (forced) {
    const url = new URL(forced);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      throw new Error("NEXO_INTERNAL_ORIGIN no es válido");
    }
    return url.origin;
  }
  const host =
    env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL;
  if (host) {
    const url = new URL(`https://${host.trim()}`);
    return url.origin;
  }
  return `http://localhost:${env.PORT || "3000"}`;
}

// Validación ---------------------------------------------------------------------------------

type Parsed = { ok: true; request: RenderRequest } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Una URL de imagen solo puede ser una ruta del propio sitio ("/…") o `data:image/…`; nunca un host. */
export function isSafeAssetUrl(value: string): boolean {
  if (value === "") return true;
  if (value.startsWith("data:image/")) return value.length <= 400_000;
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && value.length <= 500;
}

function validRestaurant(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.id) &&
    isText(value.name, 200) &&
    isText(value.brand, 200) &&
    isText(value.city, 200) &&
    isText(value.address, 400) &&
    isText(value.company, 200) &&
    isFiniteNumber(value.target) &&
    isFiniteNumber(value.total) &&
    (value.average === null || isFiniteNumber(value.average))
  );
}

/** Fila de métricas: solo valores simples (texto, número o null). */
function validMetricRow(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= 120 &&
    entries.every(([key, item]) => key.length <= 80 && (item === null || isFiniteNumber(item) || isText(item, 200)))
  );
}

function validMonthlyReport(value: unknown): value is MonthlyReportData {
  if (!isRecord(value)) return false;
  if (!validRestaurant(value.restaurant)) return false;
  if (!isText(value.label, 100) || !isText(value.startKey, 10) || !DATE_KEY.test(value.startKey)) return false;
  if (!isText(value.endKey, 10) || !DATE_KEY.test(value.endKey)) return false;
  if (!validMetricRow(value.current) || !validMetricRow(value.previous)) return false;
  if (value.criticalMaxStars !== 2 && value.criticalMaxStars !== 3) return false;

  const { weeks, reviews, reasons, criticalReasons } = value;
  if (!Array.isArray(weeks) || weeks.length > 8) return false;
  for (const week of weeks) {
    if (!isRecord(week) || !isText(week.label, 100) || !DATE_KEY.test(String(week.startKey)) || !DATE_KEY.test(String(week.endKey))) return false;
    if (![week.total, week.positive, week.neutral, week.negative].every(isFiniteNumber)) return false;
    if (week.average !== null && !isFiniteNumber(week.average)) return false;
    if (!Array.isArray(week.stars) || week.stars.length !== 5 || !week.stars.every(isFiniteNumber)) return false;
  }
  if (!Array.isArray(reviews) || reviews.length > 400) return false;
  for (const review of reviews) {
    if (!isRecord(review) || !isText(review.id, 100) || !isText(review.author, 200) || !isText(review.date, 100)) return false;
    if (review.editedAt !== null && !isText(review.editedAt, 100)) return false;
    if (!isFiniteNumber(review.stars) || !isText(review.comment, 6000)) return false;
    if (review.reason !== null && !isText(review.reason, 200)) return false;
  }
  if (!Array.isArray(reasons) || reasons.length > 60) return false;
  if (!reasons.every((item) => isRecord(item) && isText(item.label, 200) && isFiniteNumber(item.count) && isFiniteNumber(item.percent))) return false;
  if (!Array.isArray(criticalReasons) || criticalReasons.length > 60) return false;
  return criticalReasons.every(
    (item) => isRecord(item) && isText(item.label, 200) && isFiniteNumber(item.count) && typeof item.causal === "boolean"
  );
}

/** Datos de la alerta: solo valores simples, y las URL de imagen solo propias o `data:`. */
function validAlertData(value: unknown): value is NegativeReviewAlertData {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 80) return false;
  for (const [key, item] of entries) {
    if (key.length > 60) return false;
    if (item === null || item === undefined || typeof item === "boolean" || isFiniteNumber(item)) continue;
    if (typeof item === "string") {
      if (key.endsWith("_url") ? !isSafeAssetUrl(item) : item.length > 6000) return false;
      continue;
    }
    if (Array.isArray(item) && item.length <= 40 && item.every((entry) => isText(entry, 400))) continue;
    return false;
  }
  return isText(value.restaurant_name, 300) && isText(value.review_comment, 6000);
}

export function parseRenderRequest(body: unknown): Parsed {
  if (!isRecord(body) || typeof body.op !== "string") return { ok: false, error: "Operación no válida" };
  const op = body.op;
  if (!(RENDER_OPERATIONS as readonly string[]).includes(op)) return { ok: false, error: "Operación no permitida" };

  switch (op as RenderOperation) {
    case "monthly_pdf":
    case "monthly_image":
      if (!validMonthlyReport(body.report)) return { ok: false, error: "Datos del informe no válidos" };
      return { ok: true, request: { op: op as "monthly_pdf" | "monthly_image", report: body.report } };

    case "negative_review_image":
    case "whatsapp_alert_image":
      if (!validAlertData(body.data)) return { ok: false, error: "Datos de la alerta no válidos" };
      return { ok: true, request: { op: op as "negative_review_image" | "whatsapp_alert_image", data: body.data } };

    case "network_summary_image": {
      const { periodo, grupo, offset } = body;
      if (typeof periodo !== "string" || !isReportPeriodSlug(periodo)) return { ok: false, error: "Periodo no válido" };
      if (typeof grupo !== "string" || !isNetworkReportGroupId(grupo)) return { ok: false, error: "Grupo no válido" };
      if (typeof offset !== "number" || !Number.isInteger(offset) || offset < -120 || offset > 120) {
        return { ok: false, error: "Desplazamiento no válido" };
      }
      return { ok: true, request: { op: "network_summary_image", periodo, grupo, offset } };
    }
  }
}
