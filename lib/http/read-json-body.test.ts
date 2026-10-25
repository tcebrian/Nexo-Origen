import { describe, expect, it } from "vitest";
import { readJsonBody } from "./read-json-body";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://nexo.example/api/x", { method: "POST", body, headers });

describe("readJsonBody", () => {
  it("lee un JSON válido", async () => {
    expect(await readJsonBody(post(JSON.stringify({ a: 1 })), 100)).toEqual({ ok: true, value: { a: 1 } });
  });

  it("JSON inválido, vacío o sin cuerpo → 400", async () => {
    expect(await readJsonBody(post("{no"), 100)).toEqual({ ok: false, status: 400 });
    expect(await readJsonBody(post(""), 100)).toEqual({ ok: false, status: 400 });
    expect(await readJsonBody(new Request("https://nexo.example/api/x", { method: "POST" }), 100)).toEqual({ ok: false, status: 400 });
    expect(await readJsonBody(post(new Uint8Array([0xff, 0xfe, 0x7b])), 100)).toEqual({ ok: false, status: 400 });
  });

  it("cuerpo mayor que el tope → 413 (cuenta los bytes reales)", async () => {
    expect(await readJsonBody(post(JSON.stringify({ a: "x".repeat(200) })), 100)).toEqual({ ok: false, status: 413 });
  });

  it("Content-Length que ya excede el tope → 413 sin leer", async () => {
    expect(await readJsonBody(post("{}", { "content-length": "999999" }), 100)).toEqual({ ok: false, status: 413 });
  });

  it("Content-Length mentiroso (pequeño) no evita el tope", async () => {
    const result = await readJsonBody(post(JSON.stringify({ a: "x".repeat(500) }), { "content-length": "10" }), 100);
    expect(result).toEqual({ ok: false, status: 413 });
  });

  it("cuenta bytes, no caracteres", async () => {
    expect(await readJsonBody(post(JSON.stringify({ a: "ñ".repeat(60) })), 100)).toEqual({ ok: false, status: 413 });
  });
});
