import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isProtectedApiPath } from "@/lib/auth/route-guard";

/**
 * SEC-008 — el endpoint de pruebas de resumen diario de Hambar (público, con token en la URL y un hash y un id de
 * agente escritos en el código) se ha ELIMINADO. Estas pruebas evitan que reaparezca o que quede rastro en el
 * código actual. Los literales se construyen por partes para que este fichero no los contenga enteros.
 */

const ROOT = process.cwd();
const ENDPOINT_NAME = ["test-hambar", "daily-summary"].join("-");
const ENDPOINT_PATH = `/api/internal/${ENDPOINT_NAME}`;
const TOKEN_HASH = ["7b1ad12b549eab4ec4db10c70c710cf1", "b7a76c891c3511d4ec2e11901bdc2045"].join("");
const AGENT_ID = ["b0f73a2b", "2303", "4ef1", "ba2c", "bc1993ae76ab"].join("-");
const TEST_SENDER = ["sendAgentDaily", "SummaryTest"].join("");

function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (["node_modules", ".next", ".git"].includes(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return textFiles(full);
    return /\.(ts|tsx|js|mjs|json|md|sql|css)$/.test(entry) && entry !== "package-lock.json" ? [full] : [];
  });
}

const FILES = ["app", "lib", "templates", "scripts", "docs", "supabase", "data"]
  .map((dir) => join(ROOT, dir))
  .filter(existsSync)
  .flatMap(textFiles)
  .concat(["middleware.ts", "next.config.ts", "vercel.json", "package.json", "README.md", "AGENTS.md", "CLAUDE.md"].map((f) => join(ROOT, f)).filter(existsSync));

const occurrences = (needle: string) => FILES.filter((file) => readFileSync(file, "utf8").includes(needle));

describe("SEC-008 el endpoint de pruebas ya no existe", () => {
  it("el fichero de la ruta no existe", () => {
    expect(existsSync(join(ROOT, "app/api/internal", ENDPOINT_NAME))).toBe(false);
  });

  it("no queda ninguna ruta de pruebas bajo /api/internal salvo las protegidas conocidas", () => {
    const dirs = readdirSync(join(ROOT, "app/api/internal"));
    expect(dirs.filter((d) => d.startsWith("test"))).toEqual([]);
  });

  it("ya no es una ruta pública: si alguien la recrea, el middleware la protege", () => {
    expect(isProtectedApiPath(ENDPOINT_PATH)).toBe(true);
    expect(isProtectedApiPath(`${ENDPOINT_PATH}/`)).toBe(true);
    expect(isProtectedApiPath(`${ENDPOINT_PATH}/cualquier-cosa`)).toBe(true);
  });

  it("route-guard no tiene ninguna excepción para ella", () => {
    expect(readFileSync(join(ROOT, "lib/auth/route-guard.ts"), "utf8")).not.toContain(ENDPOINT_NAME);
  });

  it("las demás excepciones legítimas siguen intactas", () => {
    for (const path of [
      "/api/webhooks/whatsapp",
      "/api/webhooks/negative-review-alert",
      "/api/cron/informe-diario",
      "/api/integrations/make/daily-summary",
      "/api/internal/render",
      "/api/auth/logout",
    ]) {
      expect(isProtectedApiPath(path), path).toBe(false);
    }
    // y el resto de /api/internal sigue exigiendo sesión
    expect(isProtectedApiPath("/api/internal/cron-secret-check")).toBe(true);
    expect(isProtectedApiPath("/api/internal/whatsapp/template-check")).toBe(true);
  });
});

describe("SEC-008 no queda rastro en el código actual", () => {
  it("ningún fichero llama ni menciona el endpoint eliminado", () => {
    expect(occurrences(ENDPOINT_NAME)).toEqual([]);
  });

  it("el hash hardcodeado ya no aparece", () => {
    expect(occurrences(TOKEN_HASH)).toEqual([]);
  });

  it("el id de agente hardcodeado ya no aparece", () => {
    expect(occurrences(AGENT_ID)).toEqual([]);
  });

  it("el envío de prueba por WhatsApp a un agente arbitrario ya no existe", () => {
    expect(occurrences(TEST_SENDER)).toEqual([]);
  });
});
