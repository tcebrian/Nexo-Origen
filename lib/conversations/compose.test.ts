import { describe, expect, it } from "vitest";
import { canSubmitDraft } from "@/lib/conversations/compose";

describe("canSubmitDraft", () => {
  it("deshabilita el envío con el borrador vacío o solo espacios", () => {
    expect(canSubmitDraft("", false)).toBe(false);
    expect(canSubmitDraft("   \n ", false)).toBe(false);
  });

  it("habilita con texto", () => {
    expect(canSubmitDraft("hola", false)).toBe(true);
  });

  it("deshabilita mientras se envía (evita doble clic)", () => {
    expect(canSubmitDraft("hola", true)).toBe(false);
  });

  it("deshabilita por encima del límite de WhatsApp", () => {
    expect(canSubmitDraft("a".repeat(4096), false)).toBe(true);
    expect(canSubmitDraft("a".repeat(4097), false)).toBe(false);
  });
});
