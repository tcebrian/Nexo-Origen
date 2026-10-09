/**
 * Error que Meta devuelve cuando RECHAZA un envío (HTTP 4xx), reducido a lo necesario para diagnosticar
 * y SIN datos sensibles: ni token, ni teléfonos, ni cabeceras, ni el cuerpo completo.
 * Sin dependencias de servidor: lo comparten el cliente de Meta, el envío y las rutas.
 */
export type ProviderError = {
  /** Código HTTP de la respuesta de Meta. */
  httpStatus: number;
  /** `error.code` de Meta (p. ej. 132001). */
  code?: number;
  /** `error.error_subcode`, si existe. */
  subcode?: number;
  /** `error.type` (p. ej. "OAuthException"). */
  type?: string;
  /** Identificador de traza de Meta, útil para soporte; no es dato personal. */
  fbtraceId?: string;
  /** `error.message`, saneado. */
  message?: string;
  /** `error.error_data.details`, saneado: suele explicar el motivo exacto (idioma, variables…). */
  details?: string;
};

const MAX_TEXT = 300;

/**
 * Quita de un texto de Meta lo que no debe salir del servidor: tokens, cabeceras, correos y números de
 * teléfono (cualquier secuencia de 8 o más cifras, y el destinatario exacto aunque venga sin formato).
 */
export function sanitizeProviderText(value: unknown, redact: readonly (string | undefined)[] = []): string | undefined {
  if (typeof value !== "string") return undefined;

  let text = value.replace(/[\u0000-\u001f\u007f]+/g, " ");
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "[token]");
  text = text.replace(/\bEA[A-Za-z0-9]{12,}\b/g, "[token]");
  text = text.replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]");
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo]");
  // Valores EXACTOS que nunca deben salir (el token usado y el destinatario), tal cual o solo con sus cifras.
  for (const secret of redact) {
    if (!secret || secret.length < 6) continue;
    text = text.split(secret).join("[oculto]");
    const digits = secret.replace(/\D/g, "");
    if (digits.length >= 6) text = text.split(digits).join("[número]");
  }
  text = text.replace(/\+?\d(?:[\s().-]?\d){7,}/g, "[número]");
  text = text.replace(/\s+/g, " ").trim();

  if (text === "") return undefined;
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

const toInt = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;

/** Extrae el error de un cuerpo de respuesta de Meta (cualquier forma inesperada → solo `httpStatus`). */
export function parseProviderError(httpStatus: number, body: unknown, redact: readonly (string | undefined)[] = []): ProviderError {
  const error: ProviderError = { httpStatus };
  const source = (body as { error?: unknown } | null)?.error;
  if (typeof source !== "object" || source === null) return error;

  const fields = source as Record<string, unknown>;
  const code = toInt(fields.code);
  const subcode = toInt(fields.error_subcode);
  const type = typeof fields.type === "string" && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(fields.type) ? fields.type : undefined;
  const fbtraceId =
    typeof fields.fbtrace_id === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(fields.fbtrace_id) ? fields.fbtrace_id : undefined;
  const message = sanitizeProviderText(fields.message, redact);
  const errorData = typeof fields.error_data === "object" && fields.error_data !== null ? (fields.error_data as Record<string, unknown>) : null;
  const details = sanitizeProviderText(errorData?.details, redact);

  if (code !== undefined) error.code = code;
  if (subcode !== undefined) error.subcode = subcode;
  if (type) error.type = type;
  if (fbtraceId) error.fbtraceId = fbtraceId;
  if (message) error.message = message;
  if (details) error.details = details;
  return error;
}

/** Texto corto para la interfaz del super_admin, p. ej. "WhatsApp rechazó la plantilla (Meta 132001)". */
export function describeTemplateRejection(error: ProviderError | undefined): { message: string; detail?: string } {
  if (!error) return { message: "WhatsApp rechazó la plantilla" };
  const code =
    error.code !== undefined
      ? `Meta ${error.code}${error.subcode !== undefined ? `/${error.subcode}` : ""}`
      : `HTTP ${error.httpStatus}`;
  const detail = error.details ?? error.message;
  return { message: `WhatsApp rechazó la plantilla (${code})`, ...(detail ? { detail } : {}) };
}
