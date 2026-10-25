import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

/**
 * SEC-010 — cabeceras defensivas globales. Se evalúa la configuración REAL de Next (`headers()`) aplicando sus reglas
 * como lo hace Next (si dos reglas fijan la misma cabecera, gana la última) y se comprueba el texto de la
 * configuración para impedir que se relajen. La prueba con un servidor real se hizo con `next start` + curl.
 */

type Rule = { source: string; headers: { key: string; value: string }[] };

const rules = (await nextConfig.headers!()) as Rule[];
const configText = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

/** Solo hay dos formas de `source` en uso: "/:path*" (todo) y "<prefijo>/:path*". */
function matches(source: string, pathname: string): boolean {
  if (source === "/:path*") return true;
  expect(source.endsWith("/:path*"), `forma de source no soportada por el test: ${source}`).toBe(true);
  const prefix = source.slice(0, -"/:path*".length);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function headersFor(pathname: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of rules) {
    if (matches(rule.source, pathname)) for (const { key, value } of rule.headers) result[key.toLowerCase()] = value;
  }
  return result;
}

const EXPECTED = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
};

describe("cabeceras globales", () => {
  it.each([
    "/",
    "/login",
    "/logout",
    "/dashboard",
    "/dashboard/usuarios",
    "/dashboard/conversaciones",
    "/seleccionar-empresa",
    "/auth/change-password",
    "/auth/callback",
    "/api/auth/check",
    "/api/conversations",
    "/api/platform/users/abc/password",
    "/api/webhooks/whatsapp",
    "/api/cron/informe-diario",
    "/api/internal/render",
    "/templates/negative-review-alert",
    "/preview/negative-review-alert",
    "/preview/network-summary",
    "/nexo-origen-logo.png",
    "/fonts/inter-400-normal.woff2",
    "/_next/static/chunks/app.js",
  ])("%s recibe exactamente las cinco cabeceras", (pathname) => {
    expect(headersFor(pathname)).toEqual(EXPECTED);
  });

  it("contiene los valores esperados en la configuración", () => {
    for (const text of [
      "Content-Security-Policy",
      "frame-ancestors 'none'",
      "X-Frame-Options",
      "DENY",
      "X-Content-Type-Options",
      "nosniff",
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
      "Permissions-Policy",
    ]) {
      expect(configText).toContain(text);
    }
  });
});

describe("la CSP es mínima y no se relaja", () => {
  const allValues = rules.flatMap((rule) => rule.headers.map((h) => h.value)).join("\n");
  const csp = rules.flatMap((rule) => rule.headers.filter((h) => h.key === "Content-Security-Policy").map((h) => h.value));

  it("solo contiene la directiva frame-ancestors (no hay una CSP completa)", () => {
    expect(csp.length).toBeGreaterThan(0);
    for (const value of csp) {
      const directives = value.split(";").map((d) => d.trim().split(/\s+/)[0]);
      expect(directives).toEqual(["frame-ancestors"]);
    }
    for (const directive of ["default-src", "script-src", "style-src", "img-src", "connect-src", "font-src", "object-src", "base-uri", "form-action"]) {
      expect(allValues).not.toContain(directive);
    }
  });

  it("sin unsafe-inline, unsafe-eval, comodines ni ALLOW-FROM", () => {
    expect(allValues).not.toContain("unsafe-inline");
    expect(allValues).not.toContain("unsafe-eval");
    expect(allValues).not.toMatch(/frame-ancestors[^;]*\*/);
    expect(allValues).not.toMatch(/frame-ancestors[^;]*https?:/);
    expect(allValues.toUpperCase()).not.toContain("ALLOW-FROM");
  });

  it("no hay reglas que cambien las cabeceras fuera de las cinco esperadas", () => {
    const keys = new Set(rules.flatMap((rule) => rule.headers.map((h) => h.key.toLowerCase())));
    expect([...keys].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("no se añade HSTS aquí: lo gestiona Vercel (y nunca con includeSubDomains/preload)", () => {
    expect(allValues.toLowerCase()).not.toContain("max-age");
    expect(allValues).not.toMatch(/includeSubDomains|preload/i);
    expect(rules.flatMap((rule) => rule.headers.map((h) => h.key.toLowerCase()))).not.toContain("strict-transport-security");
  });
});

describe("única excepción: la plantilla de resumen de red en el iframe de /preview", () => {
  it("/templates/network-summary/* solo se puede enmarcar desde el mismo origen", () => {
    for (const pathname of ["/templates/network-summary/semanal/bk", "/templates/network-summary/mensual/hambar"]) {
      expect(headersFor(pathname)).toEqual({
        ...EXPECTED,
        "content-security-policy": "frame-ancestors 'self'",
        "x-frame-options": "SAMEORIGIN",
      });
    }
  });

  it("la excepción no se extiende a nada más (ni a la otra plantilla ni a /preview)", () => {
    for (const pathname of ["/templates/negative-review-alert", "/templates", "/templates/network-summaryX/a", "/preview/network-summary", "/dashboard"]) {
      expect(headersFor(pathname)["x-frame-options"], pathname).toBe("DENY");
      expect(headersFor(pathname)["content-security-policy"], pathname).toBe("frame-ancestors 'none'");
    }
  });

  it("el iframe de /preview apunta a esa plantilla del mismo origen", () => {
    const page = readFileSync(join(process.cwd(), "app/preview/network-summary/page.tsx"), "utf8");
    expect(page).toContain("/templates/network-summary/");
    expect(page).toContain("<iframe");
  });
});

describe("Nexo no usa las APIs de navegador que bloquea Permissions-Policy", () => {
  it("el código de la aplicación no usa cámara, micrófono ni geolocalización", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
      });
    const needles = ["getUserMedia", "mediaDevices", "navigator.geolocation", "MediaRecorder", "SpeechRecognition"];
    const offenders = ["app", "lib", "templates"]
      .flatMap((dir) => walk(join(process.cwd(), dir)))
      .filter((file) => needles.some((needle) => readFileSync(file, "utf8").includes(needle)));
    expect(offenders).toEqual([]);
  });
});
