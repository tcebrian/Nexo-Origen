import { describe, expect, it } from "vitest";
import { createMediaToken, secretsMatch, verifyMediaToken } from "@/lib/auth/signed-media-token";

const secret = "secreto-de-prueba-largo";
const now = 1_800_000_000_000;

describe("secretsMatch", () => {
  it("acepta igual y rechaza distinto, vacío o de otra longitud", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abd", "abc")).toBe(false);
    expect(secretsMatch("abcd", "abc")).toBe(false);
    expect(secretsMatch("", "abc")).toBe(false);
    expect(secretsMatch(null, "abc")).toBe(false);
    expect(secretsMatch("abc", undefined)).toBe(false);
  });
});

describe("media token", () => {
  const make = (over = {}) => createMediaToken({ secret, scope: "whatsapp-alert-image", resourceId: 55, nowMs: now, ...over });
  const check = (token: string | null, over = {}) =>
    verifyMediaToken({ token, secret, scope: "whatsapp-alert-image", resourceId: 55, nowMs: now + 1000, ...over });

  it("es válido para su recurso dentro de la ventana", () => {
    expect(check(make())).toBe(true);
  });
  it("no contiene el secreto", () => {
    expect(make()).not.toContain(secret);
  });
  it("caduca", () => {
    expect(check(make(), { nowMs: now + 16 * 60 * 1000 })).toBe(false);
  });
  it("no sirve para otro recurso ni otro ámbito", () => {
    expect(check(make(), { resourceId: 56 })).toBe(false);
    expect(check(make(), { scope: "otra-ruta" })).toBe(false);
  });
  it("rechaza manipulación, otro secreto, el secreto en bruto y vacío", () => {
    const [exp, sig] = make().split(".");
    expect(check(`${Number(exp) + 3600}.${sig}`)).toBe(false);
    expect(check(make(), { secret: "otro-secreto" })).toBe(false);
    expect(check(secret)).toBe(false);
    expect(check(null)).toBe(false);
    expect(check("")).toBe(false);
  });
});
