/**
 * Troceado de textos largos para WhatsApp. Funciones puras, sin dependencias
 * de servidor: la UI las usa para anunciar "Se enviará en N mensajes" y el
 * servidor para enviar exactamente los mismos trozos.
 */

/** Límite de Meta para el cuerpo de UN mensaje de texto. */
export const WHATSAPP_TEXT_MAX_CHARS = 4096;
/** Límite interno de Nexo para un texto completo (se divide en varios mensajes). */
export const MAX_OUTBOUND_TEXT_CHARS = 20_000;

/** Longitud en caracteres (puntos de código, no unidades UTF-16). */
export function textLength(text: string): number {
  return Array.from(text).length;
}

function hasContent(chars: string[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (chars[i]!.trim() !== "") return true;
  }
  return false;
}

/** Último índice de corte (exclusive) dentro de la ventana que acaba justo después de `isBreak`. */
function findCut(chars: string[], start: number, end: number, isBreak: (i: number) => boolean): number {
  for (let i = end; i > start; i--) {
    // Se corta DESPUÉS del separador: el separador se queda al final del trozo.
    if (isBreak(i - 1) && hasContent(chars, start, i)) return i;
  }
  return -1;
}

/**
 * Divide `text` en trozos de como máximo `max` caracteres.
 * Prioridad de corte: doble salto de línea → salto de línea → espacio → corte
 * duro. La concatenación de los trozos es EXACTAMENTE el texto original, con una
 * única excepción: un bloque de más de `max` espacios/saltos de línea seguidos
 * se descarta, porque WhatsApp rechaza un mensaje en blanco. Ningún trozo está
 * compuesto solo de espacios.
 */
export function splitText(text: string, max: number = WHATSAPP_TEXT_MAX_CHARS): string[] {
  if (!Number.isInteger(max) || max < 1) throw new Error("splitText: max inválido");

  const chars = Array.from(text);
  if (chars.length <= max) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (chars.length - start > max) {
    const end = start + max;

    // Ventana entera en blanco: no se puede enviar como mensaje; se salta.
    if (!hasContent(chars, start, end)) {
      start = end;
      continue;
    }

    let cut = findCut(chars, start, end, (i) => chars[i] === "\n" && chars[i - 1] === "\n" && i - 1 >= start);
    if (cut === -1) cut = findCut(chars, start, end, (i) => chars[i] === "\n");
    if (cut === -1) cut = findCut(chars, start, end, (i) => /\s/u.test(chars[i]!));
    if (cut === -1) cut = end;

    chunks.push(chars.slice(start, cut).join(""));
    start = cut;
  }

  chunks.push(chars.slice(start).join(""));
  return chunks;
}

/** Nº de mensajes de WhatsApp en que se enviaría un texto. */
export function countMessageParts(text: string): number {
  return text.trim() === "" ? 0 : splitText(text.trim()).length;
}
