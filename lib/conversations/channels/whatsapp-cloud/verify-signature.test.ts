import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "./verify-signature";

const SECRET = "test-app-secret-not-real";
const BODY = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyMetaSignature", () => {
  it("acepta una firma válida", () => {
    expect(verifyMetaSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it("acepta el cuerpo como bytes", () => {
    expect(verifyMetaSignature(new TextEncoder().encode(BODY), sign(BODY), SECRET)).toBe(true);
  });

  it("rechaza si el cuerpo cambia mínimamente", () => {
    expect(verifyMetaSignature(`${BODY} `, sign(BODY), SECRET)).toBe(false);
  });

  it("rechaza si el secret es distinto", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, "otro-secret"), SECRET)).toBe(false);
  });

  it("rechaza si falta la firma", () => {
    expect(verifyMetaSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rechaza si falta el secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY), undefined)).toBe(false);
    expect(verifyMetaSignature(BODY, sign(BODY), null)).toBe(false);
    expect(verifyMetaSignature(BODY, sign(BODY), "")).toBe(false);
  });

  it("rechaza un prefijo incorrecto", () => {
    const hex = sign(BODY).slice("sha256=".length);
    expect(verifyMetaSignature(BODY, `sha1=${hex}`, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, hex, SECRET)).toBe(false);
  });

  it("rechaza una firma malformada (no hexadecimal)", () => {
    expect(verifyMetaSignature(BODY, `sha256=${"z".repeat(64)}`, SECRET)).toBe(false);
  });

  it("rechaza una firma de longitud incorrecta", () => {
    const valid = sign(BODY);
    expect(verifyMetaSignature(BODY, valid.slice(0, -2), SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, `${valid}00`, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "sha256=", SECRET)).toBe(false);
  });
});
