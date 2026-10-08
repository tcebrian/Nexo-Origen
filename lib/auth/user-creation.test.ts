import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_CHARS, USER_KINDS, parseNewUserBody, validateNewPassword, validatePasswordValue } from "@/lib/auth/user-creation";

const base = { nombre: " Víctor Soria ", email: " Victor@Example.COM ", password: "inicial-12345", empresaId: 1 };

describe("parseNewUserBody", () => {
  it("traduce el tipo visible al rol técnico", () => {
    expect(USER_KINDS.map((kind) => [kind.label, kind.rol])).toEqual([
      ["Administrador empresa", "empresa_admin"],
      ["Responsable de marca", "marca_admin"],
      ["Cuenta de restaurantes", "restaurante_user"],
    ]);
    expect(parseNewUserBody({ ...base, tipo: "empresa" })).toMatchObject({ ok: true, rol: "empresa_admin" });
    expect(parseNewUserBody({ ...base, tipo: "marca" })).toMatchObject({ ok: true, rol: "marca_admin" });
    expect(parseNewUserBody({ ...base, tipo: "restaurantes" })).toMatchObject({ ok: true, rol: "restaurante_user" });
  });

  it("normaliza el nombre y pasa el email a minúsculas sin espacios", () => {
    expect(parseNewUserBody({ ...base, tipo: "restaurantes" })).toMatchObject({
      ok: true,
      nombre: "Víctor Soria",
      email: "victor@example.com",
      empresaId: 1,
    });
  });

  it("el navegador no puede enviar un rol: solo el tipo, y super_admin es imposible", () => {
    for (const tipo of ["super_admin", "restaurante_user", "empresa_admin", "admin", "", null, undefined, 3]) {
      expect(parseNewUserBody({ ...base, tipo }).ok).toBe(false);
    }
    // Un campo `rol` enviado a mano se ignora.
    expect(parseNewUserBody({ ...base, tipo: "restaurantes", rol: "super_admin" })).toMatchObject({
      ok: true,
      rol: "restaurante_user",
    });
  });

  it("nombre, email y empresa inválidos se rechazan", () => {
    for (const nombre of ["", "   ", null, 5, "a".repeat(101)]) {
      expect(parseNewUserBody({ ...base, tipo: "restaurantes", nombre }).ok).toBe(false);
    }
    for (const email of ["", "sin-arroba", "a@b", "a b@c.com", "<x@y.com>", null, 7, `${"a".repeat(250)}@x.com`]) {
      expect(parseNewUserBody({ ...base, tipo: "restaurantes", email }).ok).toBe(false);
    }
    for (const empresaId of [0, -1, 1.5, "1", null, undefined]) {
      expect(parseNewUserBody({ ...base, tipo: "restaurantes", empresaId }).ok).toBe(false);
    }
    expect(parseNewUserBody(null).ok).toBe(false);
  });

  it("la contraseña inicial es obligatoria y válida (10-72 caracteres)", () => {
    for (const password of [undefined, null, 5, "", "corta", "a".repeat(MIN_PASSWORD_CHARS - 1), "a".repeat(73)]) {
      expect(parseNewUserBody({ ...base, tipo: "restaurantes", password }).ok).toBe(false);
    }
    expect(parseNewUserBody({ ...base, tipo: "restaurantes", password: "a".repeat(10) }).ok).toBe(true);
    expect(validatePasswordValue(" ".repeat(10)).ok).toBe(true); // no se recorta
  });

  it("obligar a cambiar la contraseña es lo normal; solo un false explícito lo desactiva", () => {
    expect(parseNewUserBody({ ...base, tipo: "restaurantes" })).toMatchObject({ ok: true, mustChangePassword: true });
    expect(parseNewUserBody({ ...base, tipo: "restaurantes", mustChangePassword: false })).toMatchObject({ mustChangePassword: false });
    expect(parseNewUserBody({ ...base, tipo: "restaurantes", mustChangePassword: "no" }).ok).toBe(false);
  });

  it("devuelve las listas sin validar: las valida el acceso contra la empresa elegida", () => {
    expect(parseNewUserBody({ ...base, tipo: "restaurantes", restaurantIds: [1, 2], marcaIds: [3] })).toMatchObject({
      restaurantIds: [1, 2],
      marcaIds: [3],
    });
  });
});

describe("validateNewPassword", () => {
  it("exige longitud mínima y que coincida", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_CHARS), "a".repeat(MIN_PASSWORD_CHARS))).toEqual({ ok: true });
    expect(validateNewPassword("corta", "corta")).toMatchObject({ ok: false });
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_CHARS), "b".repeat(MIN_PASSWORD_CHARS))).toMatchObject({
      ok: false,
      error: "Las contraseñas no coinciden.",
    });
  });
});
