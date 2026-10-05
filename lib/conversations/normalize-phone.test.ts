import { describe, expect, it } from "vitest";
import { normalizeManualPhone, normalizeProviderPhone } from "./normalize-phone";

const EXPECTED = "+34688718820";

describe("normalizeProviderPhone", () => {
  it.each([
    ["34688718820"],
    ["+34688718820"],
    ["whatsapp:+34688718820"],
    ["WhatsApp:+34688718820"],
    ["whatsapp:34688718820"],
    ["  34688718820  "],
  ])("normaliza %j", (input) => {
    expect(normalizeProviderPhone(input)).toBe(EXPECTED);
  });

  it("funciona con otros países", () => {
    expect(normalizeProviderPhone("14155550132")).toBe("+14155550132");
    expect(normalizeProviderPhone("447911123456")).toBe("+447911123456");
  });

  it("trata los dígitos como ya internacionales (contrato del proveedor)", () => {
    // No infiere España ni ningún país: solo antepone "+".
    expect(normalizeProviderPhone("688718820")).toBe("+688718820");
  });

  it("rechaza separadores visuales y texto: no es un dato de proveedor", () => {
    expect(normalizeProviderPhone("+34 688 71 88 20")).toBeNull();
    expect(normalizeProviderPhone("+34-688-718-820")).toBeNull();
    expect(normalizeProviderPhone("+34 (688) 718 820")).toBeNull();
    expect(normalizeProviderPhone("+34688718820 ext 5")).toBeNull();
    expect(normalizeProviderPhone("+34 688 71 88 2O")).toBeNull();
  });

  it("devuelve null para vacíos y no string", () => {
    expect(normalizeProviderPhone("")).toBeNull();
    expect(normalizeProviderPhone("   ")).toBeNull();
    expect(normalizeProviderPhone("whatsapp:")).toBeNull();
    expect(normalizeProviderPhone("+")).toBeNull();
    expect(normalizeProviderPhone(null)).toBeNull();
    expect(normalizeProviderPhone(undefined)).toBeNull();
    expect(normalizeProviderPhone(34688718820 as unknown as string)).toBeNull();
  });

  it("devuelve null para formatos claramente inválidos", () => {
    expect(normalizeProviderPhone("123")).toBeNull();
    expect(normalizeProviderPhone("+0688718820")).toBeNull();
    expect(normalizeProviderPhone("0034688718820")).toBeNull();
    expect(normalizeProviderPhone("1234567890123456")).toBeNull();
    expect(normalizeProviderPhone("+34+688718820")).toBeNull();
    expect(normalizeProviderPhone("34688718820+")).toBeNull();
    expect(normalizeProviderPhone("\u0000￿")).toBeNull();
  });
});

describe("normalizeManualPhone", () => {
  it("combina prefijo explícito y número nacional", () => {
    expect(
      normalizeManualPhone({ countryCallingCode: "34", nationalNumber: "688 718 820" })
    ).toBe(EXPECTED);
  });

  it("acepta el prefijo con o sin +", () => {
    expect(
      normalizeManualPhone({ countryCallingCode: "+34", nationalNumber: "688718820" })
    ).toBe(EXPECTED);
    expect(
      normalizeManualPhone({ countryCallingCode: " 34 ", nationalNumber: "688718820" })
    ).toBe(EXPECTED);
  });

  it("elimina espacios, guiones, puntos y paréntesis del número", () => {
    for (const national of ["688-718-820", "(688) 718 820", "688.718.820", "688 71 88 20"]) {
      expect(normalizeManualPhone({ countryCallingCode: "34", nationalNumber: national })).toBe(
        EXPECTED
      );
    }
  });

  it("funciona con otros países", () => {
    expect(
      normalizeManualPhone({ countryCallingCode: "1", nationalNumber: "(415) 555-0132" })
    ).toBe("+14155550132");
  });

  it("sin prefijo de país NO infiere ninguno", () => {
    const national = "688718820";
    expect(normalizeManualPhone({ countryCallingCode: "", nationalNumber: national })).toBeNull();
    expect(normalizeManualPhone({ countryCallingCode: "  ", nationalNumber: national })).toBeNull();
    expect(normalizeManualPhone({ countryCallingCode: null, nationalNumber: national })).toBeNull();
    expect(
      normalizeManualPhone({ countryCallingCode: undefined, nationalNumber: national })
    ).toBeNull();
  });

  it("rechaza prefijos de país inválidos", () => {
    for (const code of ["0", "034", "3 4", "abc", "1234", "++34", "+"]) {
      expect(
        normalizeManualPhone({ countryCallingCode: code, nationalNumber: "688718820" })
      ).toBeNull();
    }
  });

  it("rechaza números nacionales vacíos, con letras o ya internacionales", () => {
    const bad = ["", "   ", "688 71 88 2O", "+34688718820", "0034688718820", "688/718/820"];
    for (const national of bad) {
      expect(
        normalizeManualPhone({ countryCallingCode: "34", nationalNumber: national })
      ).toBeNull();
    }
  });

  it("rechaza longitudes imposibles", () => {
    expect(normalizeManualPhone({ countryCallingCode: "34", nationalNumber: "123" })).toBeNull();
    expect(
      normalizeManualPhone({ countryCallingCode: "34", nationalNumber: "12345678901234" })
    ).toBeNull();
  });

  it("no lanza con entradas no válidas", () => {
    expect(() =>
      normalizeManualPhone({ countryCallingCode: 34 as unknown as string, nationalNumber: "1" })
    ).not.toThrow();
    expect(
      normalizeManualPhone(undefined as unknown as Parameters<typeof normalizeManualPhone>[0])
    ).toBeNull();
  });
});
