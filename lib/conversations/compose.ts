import { MAX_OUTBOUND_TEXT_CHARS } from "@/lib/conversations/send-text";

/** ¿Se puede pulsar Enviar? No con borrador vacío, ya enviando o por encima del límite. */
export function canSubmitDraft(draft: string, sending: boolean): boolean {
  if (sending) return false;
  const trimmed = draft.trim();
  return trimmed !== "" && Array.from(trimmed).length <= MAX_OUTBOUND_TEXT_CHARS;
}
