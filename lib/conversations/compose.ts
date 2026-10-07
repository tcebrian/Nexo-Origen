import { MAX_OUTBOUND_TEXT_CHARS, textLength } from "@/lib/conversations/text-chunks";

/**
 * ¿Se puede pulsar Enviar? No si ya se está enviando, el borrador está vacío o
 * supera el límite interno (20.000; si pasa de 4096 se envía en varios mensajes).
 */
export function canSubmitDraft(draft: string, sending: boolean): boolean {
  if (sending) return false;
  const trimmed = draft.trim();
  return trimmed !== "" && textLength(trimmed) <= MAX_OUTBOUND_TEXT_CHARS;
}
