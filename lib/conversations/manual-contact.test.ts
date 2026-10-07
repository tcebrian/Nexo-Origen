import { describe, expect, it } from "vitest";
import { parseManualContactBody } from "@/lib/conversations/manual-contact";

const USER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("parseManualContactBody", () => {
  it("normaliza el teléfono a E.164 con el prefijo elegido explícitamente", () => {
    expect(parseManualContactBody({ nombre: " Víctor ", countryCallingCode: "+34", nationalNumber: "688 718 820" })).toEqual({
      ok: true,
      nombre: "Víctor",
      telefonoE164: "+34688718820",
      usuarioId: null,
    });
    expect(parseManualContactBody({ countryCallingCode: "34", nationalNumber: "688-718-820" })).toMatchObject({
      telefonoE164: "+34688718820",
    });
  });

  it("nunca infiere el país: sin prefijo, o con un número ya internacional, es un error", () => {
    expect(parseManualContactBody({ nationalNumber: "688718820" }).ok).toBe(false);
    expect(parseManualContactBody({ countryCallingCode: "", nationalNumber: "688718820" }).ok).toBe(false);
    expect(parseManualContactBody({ countryCallingCode: "+34", nationalNumber: "+34688718820" }).ok).toBe(false);
    expect(parseManualContactBody({ countryCallingCode: "+34", nationalNumber: "0034688718820" }).ok).toBe(false);
  });

  it("teléfonos inválidos (letras, muy cortos o muy largos) se rechazan", () => {
    for (const nationalNumber of ["abc", "12", "6887188201234567890", "", null, 688718820]) {
      expect(parseManualContactBody({ countryCallingCode: "+34", nationalNumber }).ok).toBe(false);
    }
    expect(parseManualContactBody(null).ok).toBe(false);
  });

  it("el nombre es opcional y se recorta; vacío = sin nombre; demasiado largo o no textual se rechaza", () => {
    const base = { countryCallingCode: "+34", nationalNumber: "688718820" };
    expect(parseManualContactBody({ ...base })).toMatchObject({ ok: true, nombre: null });
    expect(parseManualContactBody({ ...base, nombre: "   " })).toMatchObject({ ok: true, nombre: null });
    expect(parseManualContactBody({ ...base, nombre: "a".repeat(101) }).ok).toBe(false);
    expect(parseManualContactBody({ ...base, nombre: 5 }).ok).toBe(false);
  });

  it("el usuario Nexo es opcional y debe ser un UUID", () => {
    const base = { countryCallingCode: "+34", nationalNumber: "688718820" };
    expect(parseManualContactBody({ ...base, usuarioId: USER })).toMatchObject({ ok: true, usuarioId: USER });
    expect(parseManualContactBody({ ...base, usuarioId: "" })).toMatchObject({ ok: true, usuarioId: null });
    expect(parseManualContactBody({ ...base, usuarioId: null })).toMatchObject({ ok: true, usuarioId: null });
    expect(parseManualContactBody({ ...base, usuarioId: "x" }).ok).toBe(false);
    expect(parseManualContactBody({ ...base, usuarioId: 7 }).ok).toBe(false);
  });

  it("no acepta restaurantes, rol, empresa ni permisos: solo teléfono, nombre y usuario", () => {
    const parsed = parseManualContactBody({
      countryCallingCode: "+34",
      nationalNumber: "688718820",
      usuarioId: USER,
      restaurantIds: [1, 2, 3],
      restauranteIds: [1],
      marcaIds: [10],
      rol: "super_admin",
      empresaId: 1,
      scope: { rol: "super_admin" },
    });
    expect(parsed).toEqual({ ok: true, nombre: null, telefonoE164: "+34688718820", usuarioId: USER });
  });
});
