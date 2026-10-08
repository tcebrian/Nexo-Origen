import { createHash } from "node:crypto";

/**
 * Id de idempotencia de cada mensaje de una operación de envío.
 *
 * El cliente envía UN `requestId` por operación. El mensaje 0 usa exactamente ese
 * id (compatible con CONV-010); el resto usa un UUID estable derivado de
 * (requestId, índice). Así `conv_mensajes.client_request_id` sigue siendo único
 * por fila y un reintento de la misma operación recalcula los mismos ids.
 */
/**
 * UUID estable derivado de un texto semilla. Sirve para operaciones que deben ser idempotentes
 * sin que las dirija el navegador (activación de un contacto, respuesta a un mensaje entrante).
 */
export function deriveStableRequestId(seed: string): string {
  const hex = createHash("sha256").update(`nexo-conv-stable:${seed}`).digest("hex");
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return [hex.slice(0, 8), hex.slice(8, 12), `5${hex.slice(13, 16)}`, `${variant}${hex.slice(17, 20)}`, hex.slice(20, 32)].join("-");
}

export function deriveMessageRequestId(requestId: string, index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("deriveMessageRequestId: índice inválido");
  if (index === 0) return requestId;

  const hex = createHash("sha256").update(`nexo-conv-send:${requestId}:${index}`).digest("hex");
  // Formato UUID v5-like: versión 5 y variante RFC 4122.
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
