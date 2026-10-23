import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** SEC-004 — el optimizador de imágenes solo puede descargar del Supabase de Nexo, no de cualquier proyecto. */
describe("next.config.ts images.remotePatterns", () => {
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  const code = config
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("permite solo el host exacto del proyecto Supabase de Nexo", () => {
    expect(code).toContain('hostname: "tsbkcaxbgzfnpqmihabb.supabase.co"');
  });

  it("no contiene comodines de supabase.co", () => {
    expect(code).not.toContain("**.supabase.co");
    expect(code).not.toMatch(/hostname:\s*"\*/);
  });

  it("mantiene https y solo el storage público", () => {
    expect(code).toContain('protocol: "https"');
    expect(code).toContain('pathname: "/storage/v1/object/public/**"');
  });
});
