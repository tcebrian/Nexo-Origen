import type { InboundMessage } from "@/lib/conversations/types";

/** La columna admite 200 caracteres; se deja margen para el "…". */
const MAX_TEXT_PREVIEW_CHARS = 140;

function truncateByCodePoints(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : `${chars.slice(0, max).join("")}…`;
}

/**
 * Vista previa corta y determinista del último mensaje, para la lista de
 * conversaciones. Función pura: sin IA ni acceso a datos.
 */
export function buildMessagePreview(
  message: Pick<InboundMessage, "contentType" | "text" | "media">
): string {
  switch (message.contentType) {
    case "text": {
      const flat = (message.text ?? "").replace(/\s+/g, " ").trim();
      return flat === "" ? "Mensaje vacío" : truncateByCodePoints(flat, MAX_TEXT_PREVIEW_CHARS);
    }
    case "audio":
      return message.media?.isVoiceMessage ? "🎤 Nota de voz" : "🎤 Audio";
    case "image":
      return "🖼️ Imagen";
    case "video":
      return "🎥 Vídeo";
    case "document":
      return "📄 Documento";
    case "sticker":
      return "Sticker";
    case "unsupported":
    default:
      return "Mensaje no compatible";
  }
}
