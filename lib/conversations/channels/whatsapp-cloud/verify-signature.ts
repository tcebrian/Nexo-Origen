import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";
const SHA256_HEX_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Valida la cabecera `X-Hub-Signature-256` de un webhook de WhatsApp Cloud API.
 *
 * `rawBody` debe ser el cuerpo exacto recibido (sin parsear ni reserializar).
 * Función pura: devuelve `false` ante cualquier entrada inválida, sin lanzar.
 */
export function verifyMetaSignature(
  rawBody: string | Uint8Array,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined
): boolean {
  try {
    if (!signatureHeader || !appSecret) return false;
    if (typeof rawBody !== "string" && !(rawBody instanceof Uint8Array)) return false;
    if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

    const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
    if (receivedHex.length !== SHA256_HEX_LENGTH || !HEX_PATTERN.test(receivedHex)) {
      return false;
    }

    const expected = createHmac("sha256", appSecret).update(rawBody).digest();
    const received = Buffer.from(receivedHex, "hex");
    if (received.length !== expected.length) return false;

    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
