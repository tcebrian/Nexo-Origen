/**
 * Normalización de teléfonos a E.164 (`+34688718820`).
 *
 * Hay dos funciones con semántica distinta, a propósito. Ninguna adivina el
 * país: la única fuente del prefijo es el propio dato del proveedor o el
 * `countryCallingCode` explícito que elija el usuario.
 */

const WHATSAPP_PREFIX = /^whatsapp:/i;
const VISUAL_SEPARATORS = /[\s\-().]/g;
const DIGITS_ONLY = /^\d+$/;
/** Prefijo de país: 1 a 3 dígitos, sin 0 inicial. */
const CALLING_CODE = /^[1-9]\d{0,2}$/;
const MIN_TOTAL_DIGITS = 8;
const MAX_TOTAL_DIGITS = 15;

function toE164(digits: string): string | null {
  if (digits.length < MIN_TOTAL_DIGITS || digits.length > MAX_TOTAL_DIGITS) return null;
  return `+${digits}`;
}

/**
 * Identificador de teléfono que entrega un proveedor (p. ej. `wa_id` de
 * WhatsApp: `34688718820`). Los dígitos ya incluyen el prefijo de país.
 *
 * Acepta `whatsapp:` opcional y `+` opcional. No admite separadores visuales:
 * un dato de proveedor con formato es un dato anómalo. NO usar con texto
 * escrito por una persona; para eso, `normalizeManualPhone`.
 */
export function normalizeProviderPhone(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;

  let value = input.trim().replace(WHATSAPP_PREFIX, "");
  if (value.startsWith("+")) value = value.slice(1);

  if (!DIGITS_ONLY.test(value) || value.startsWith("0")) return null;
  return toE164(value);
}

export type ManualPhoneInput = {
  /** Prefijo de país elegido explícitamente: `"34"` o `"+34"`. */
  countryCallingCode: string | null | undefined;
  /** Número nacional tal como lo escribe la persona: `"688 718 820"`. */
  nationalNumber: string | null | undefined;
};

/**
 * Teléfono escrito a mano: prefijo de país explícito + número nacional.
 *
 * Sin prefijo → `null` (nunca se infiere). Tampoco se interpreta un número
 * nacional que ya traiga `+` o `00`, ni se quitan ceros iniciales o prefijos
 * de troncal: eso depende del país y sería adivinar.
 */
export function normalizeManualPhone(input: ManualPhoneInput): string | null {
  const { countryCallingCode, nationalNumber } = input ?? {};
  if (typeof countryCallingCode !== "string" || typeof nationalNumber !== "string") {
    return null;
  }

  const code = countryCallingCode.trim().replace(/^\+/, "");
  if (!CALLING_CODE.test(code)) return null;

  const national = nationalNumber.trim().replace(VISUAL_SEPARATORS, "");
  if (!DIGITS_ONLY.test(national)) return null;
  if (national.startsWith("00")) return null;

  return toE164(`${code}${national}`);
}
