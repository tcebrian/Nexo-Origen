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

  it("no bloquea en 4096: el límite es el interno de 20.000", () => {
    expect(canSubmitDraft("a".repeat(4097), false)).toBe(true);
    expect(canSubmitDraft("a".repeat(20_000), false)).toBe(true);
    expect(canSubmitDraft("a".repeat(20_001), false)).toBe(false);
  });
});
