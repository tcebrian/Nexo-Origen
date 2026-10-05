import { describe, expect, it } from "vitest";
import { buildMessagePreview } from "./message-preview";

const media = { externalMediaId: "m1", mimeType: "x/y" };

describe("buildMessagePreview", () => {
  it("texto: devuelve el propio texto", () => {
    expect(buildMessagePreview({ contentType: "text", text: "¿Cómo vamos hoy?" })).toBe(
      "¿Cómo vamos hoy?"
    );
  });

  it("texto: aplana saltos de línea y espacios", () => {
    expect(buildMessagePreview({ contentType: "text", text: "  Hola\n\n  qué   tal \t" })).toBe(
      "Hola qué tal"
    );
  });

  it("texto: se trunca por caracteres sin partir emojis y cabe en 200", () => {
    const long = "🍔".repeat(300);
    const preview = buildMessagePreview({ contentType: "text", text: long });
    expect(preview).toBe(`${"🍔".repeat(140)}…`);
    expect(Array.from(preview).length).toBeLessThanOrEqual(200);
  });

  it("texto: no trunca un texto justo en el límite", () => {
    const exact = "a".repeat(140);
    expect(buildMessagePreview({ contentType: "text", text: exact })).toBe(exact);
  });

  it("texto vacío o ausente", () => {
    expect(buildMessagePreview({ contentType: "text", text: "   " })).toBe("Mensaje vacío");
    expect(buildMessagePreview({ contentType: "text" })).toBe("Mensaje vacío");
  });

  it("audio y nota de voz", () => {
    expect(buildMessagePreview({ contentType: "audio", media })).toBe("🎤 Audio");
    expect(buildMessagePreview({ contentType: "audio", media: { ...media, isVoiceMessage: true } })).toBe(
      "🎤 Nota de voz"
    );
  });

  it("imagen, vídeo, documento y sticker", () => {
    expect(buildMessagePreview({ contentType: "image", media })).toBe("🖼️ Imagen");
    expect(buildMessagePreview({ contentType: "video", media })).toBe("🎥 Vídeo");
    expect(buildMessagePreview({ contentType: "document", media })).toBe("📄 Documento");
    expect(buildMessagePreview({ contentType: "sticker", media })).toBe("Sticker");
  });

  it("los medios no usan el pie de foto ni el texto", () => {
    expect(
      buildMessagePreview({ contentType: "image", text: "no", media: { ...media, caption: "pie" } })
    ).toBe("🖼️ Imagen");
  });

  it("unsupported", () => {
    expect(buildMessagePreview({ contentType: "unsupported" })).toBe("Mensaje no compatible");
  });
});
