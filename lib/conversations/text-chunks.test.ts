import { describe, expect, it } from "vitest";
import {
  WHATSAPP_TEXT_MAX_CHARS,
  countMessageParts,
  splitText,
  textLength,
} from "@/lib/conversations/text-chunks";
import { deriveMessageRequestId } from "@/lib/conversations/request-ids";

const MAX = WHATSAPP_TEXT_MAX_CHARS;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function paragraphs(total: number, size = 300): string {
  const out: string[] = [];
  let used = 0;
  let i = 0;
  while (used < total) {
    const p = `P${i++} ` + "palabra ".repeat(Math.ceil(size / 8)).slice(0, size);
    out.push(p);
    used += p.length + 2;
  }
  return out.join("\n\n").slice(0, total);
}

describe("splitText", () => {
  it("≤ 4096 caracteres → un solo trozo idéntico", () => {
    const text = "a".repeat(MAX);
    expect(splitText(text)).toEqual([text]);
    expect(splitText("hola")).toEqual(["hola"]);
  });

  it("4097 caracteres → dos trozos", () => {
    expect(splitText("a".repeat(MAX + 1))).toHaveLength(2);
  });

  it("9.500 caracteres → 3 trozos", () => {
    expect(splitText("x".repeat(9500))).toHaveLength(3);
    expect(countMessageParts(paragraphs(9500))).toBeGreaterThanOrEqual(3);
  });

  it.each([4097, 8192, 9500, 20_000])("%i caracteres: ningún trozo supera 4096 y se reconstruye exactamente", (n) => {
    const text = paragraphs(n);
    const chunks = splitText(text);
    expect(chunks.every((c) => textLength(c) <= MAX)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  it("prefiere cortar por doble salto de línea", () => {
    const a = "a".repeat(3000);
    const b = "b".repeat(3000);
    const [first, second] = splitText(`${a}\n\n${b}`);
    expect(first).toBe(`${a}\n\n`);
    expect(second).toBe(b);
  });

  it("sin párrafos corta por salto de línea y después por espacio", () => {
    const line = `${"a".repeat(3000)}\n${"b".repeat(3000)}`;
    expect(splitText(line)[0]).toBe(`${"a".repeat(3000)}\n`);

    const spaced = `${"a".repeat(3000)} ${"b".repeat(3000)}`;
    expect(splitText(spaced)[0]).toBe(`${"a".repeat(3000)} `);
  });

  it("solo corta una palabra si no hay alternativa", () => {
    const chunks = splitText("z".repeat(MAX * 2 + 10));
    expect(chunks.map(textLength)).toEqual([MAX, MAX, 10]);
  });

  it("cuenta emojis como un carácter y no los parte", () => {
    const text = "😀".repeat(MAX + 5);
    const chunks = splitText(text);
    expect(chunks.map(textLength)).toEqual([MAX, 5]);
    expect(chunks.join("")).toBe(text);
  });

  it("ningún trozo es solo espacios (un bloque en blanco > 4096 se descarta)", () => {
    const text = `${"a".repeat(10)}${" ".repeat(MAX * 2)}${"b".repeat(10)}`;
    const chunks = splitText(text);
    expect(chunks.every((c) => c.trim() !== "")).toBe(true);
    expect(chunks.join("").replace(/\s+/g, "")).toBe(`${"a".repeat(10)}${"b".repeat(10)}`);
    expect(chunks.every((c) => textLength(c) <= MAX)).toBe(true);
  });
});

describe("deriveMessageRequestId", () => {
  const request = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

  it("el mensaje 0 usa el requestId tal cual", () => {
    expect(deriveMessageRequestId(request, 0)).toBe(request);
  });

  it("los demás son UUID estables, distintos entre sí y entre operaciones", () => {
    const ids = [1, 2, 3].map((i) => deriveMessageRequestId(request, i));
    expect(ids.every((id) => UUID_RE.test(id))).toBe(true);
    expect(new Set([request, ...ids]).size).toBe(4);
    expect(ids).toEqual([1, 2, 3].map((i) => deriveMessageRequestId(request, i)));
    expect(deriveMessageRequestId("11111111-1111-4111-8111-111111111111", 1)).not.toBe(ids[0]);
  });
});
