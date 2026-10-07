import { describe, expect, it } from "vitest";
import { parseManualContactBody } from "@/lib/conversations/manual-contact";

describe("parseManualContactBody", () => {
  it("normaliza el teléfono a E.164 con el prefijo elegido explícitamente", () => {
    expect(parseManualContactBody({ nombre: " Víctor ", countryCallingCode: "+34", nationalNumber: "688 718 820" })).toMatchObject({
      ok: true,
      nombre: "Víctor",
      telefonoE164: "+34688718820",
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

  it("teléfonos inválidos se rechazan", () => {
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

  it("devuelve tipo, empresa, 'todos' y restaurantes SIN validar (los valida el catálogo)", () => {
    const parsed = parseManualContactBody({
      countryCallingCode: "+34",
      nationalNumber: "688718820",
      tipo: "supervisor",
      empresaId: 1,
      todosRestaurantes: false,
      restaurantIds: [1, 2, 3],
    });
    expect(parsed).toMatchObject({
      ok: true,
      access: { tipo: "supervisor", empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 2, 3] },
    });
  });

  it("la cuenta web no interviene en el alta: usuarioId, rol, scope… se ignoran", () => {
    const parsed = parseManualContactBody({
      countryCallingCode: "+34",
      nationalNumber: "688718820",
      usuarioId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      rol: "super_admin",
      scope: { rol: "super_admin" },
    });
    expect(parsed).toEqual({
      ok: true,
      nombre: null,
      telefonoE164: "+34688718820",
      access: { tipo: undefined, empresaId: undefined, todosRestaurantes: undefined, restaurantIds: undefined },
    });
  });
});
