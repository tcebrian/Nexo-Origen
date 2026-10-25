import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OTHER_RATE_LIMITED_OPERATIONS, SENSITIVE_RATE_LIMITS } from "@/lib/security/rate-limits";

/**
 * SEC-013 — inventario EXPLÍCITO de las operaciones sensibles con límite. No es "todo POST": si mañana aparece una ruta
 * claramente peligrosa se añade aquí a propósito (y a `SENSITIVE_RATE_LIMITS`). Este test fija además qué rutas NO se
 * limitan y por qué, y el orden sesión → rol → límite → cuerpo/parámetros → operación.
 */

const ROOT = process.cwd();
const source = (route: string) => readFileSync(join(ROOT, "app/api", route, "route.ts"), "utf8").replace(/\r\n/g, "\n");

/** Cuerpo de un método exportado (hasta el siguiente `export` o el final del fichero). */
function methodBody(src: string, method: string): string {
  const start = src.search(new RegExp(`export async function ${method}\\b`));
  expect(start, `no existe ${method}`).toBeGreaterThanOrEqual(0);
  const rest = src.slice(start + 1);
  const next = rest.search(/\nexport (async )?(function|const) /);
  return next === -1 ? src.slice(start) : src.slice(start, start + 1 + next);
}

type Sensitive = { route: string; method: string; operation: keyof typeof SENSITIVE_RATE_LIMITS; class: string };

// Clases: B = mutación, C = envío externo, D = operación costosa (Chromium / PDF).
const SENSITIVE: Sensitive[] = [
  { route: "auth/change-password", method: "POST", operation: "auth-change-password", class: "B" },
  { route: "platform/users", method: "POST", operation: "platform-user-create", class: "B" },
  { route: "platform/users/[userId]", method: "PUT", operation: "platform-user-access", class: "B" },
  { route: "platform/users/[userId]/password", method: "POST", operation: "platform-user-password", class: "B" },
  { route: "agents/create", method: "POST", operation: "agents-create", class: "B" },
  { route: "agents/update", method: "POST", operation: "agents-update", class: "B" },
  { route: "agents/daily-summary/preview", method: "POST", operation: "agents-summary-preview", class: "D" },
  { route: "restaurants/onboarding/create", method: "POST", operation: "restaurant-onboarding-create", class: "B" },
  { route: "conversations/[conversationId]/messages", method: "POST", operation: "conversation-send", class: "C" },
  { route: "conversations/[conversationId]/template-test", method: "POST", operation: "conversation-template-test", class: "C" },
  { route: "conversations/[conversationId]/reports", method: "POST", operation: "conversation-report-send", class: "C" },
  { route: "conversations/[conversationId]/activation", method: "POST", operation: "conversation-activation", class: "C" },
  { route: "conversations/contacts", method: "POST", operation: "conversation-contact-create", class: "B" },
  { route: "conversations/[conversationId]/negative-alerts", method: "PUT", operation: "conversation-negative-alerts", class: "B" },
  { route: "generate-network-summary-image", method: "GET", operation: "network-summary-image", class: "D" },
  { route: "informes/mensual/[id]", method: "GET", operation: "monthly-report-render", class: "D" },
  { route: "informes/mensual/[id]/imagen", method: "GET", operation: "monthly-report-render", class: "D" },
  { route: "reports/pdf", method: "POST", operation: "report-pdf", class: "D" },
  { route: "reports/pdf/[id]", method: "GET", operation: "report-pdf", class: "D" },
];

describe("inventario de rutas sensibles con límite", () => {
  it.each(SENSITIVE)("$method /api/$route usa '$operation' con el helper del usuario autenticado", ({ route, method, operation }) => {
    const body = methodBody(source(route), method);
    expect(body).toContain(`rateLimitAuthenticatedUser("${operation}", `);
    // El id sale de la sesión resuelta en el servidor, nunca del cliente.
    const call = /rateLimitAuthenticatedUser\("[a-z-]+", ([^)]+)\)/.exec(body)![1]!;
    expect(call).toMatch(/^(auth\.session\.userId|session\.userId|result\.session\.userId|user\.id)$/);
    expect(call).not.toMatch(/body|params|searchParams|request|headers|forwarded/i);
  });

  it("el límite va después de sesión y rol y antes de leer cuerpo o parámetros", () => {
    for (const { route, method } of SENSITIVE) {
      const body = methodBody(source(route), method);
      const limit = body.indexOf("rateLimitAuthenticatedUser(");
      const identity = Math.max(body.indexOf("requireApiAuth("), body.indexOf("getAuthSession("), body.indexOf("auth.getUser("), body.indexOf("authorize("));
      expect(identity, `${method} ${route}: identidad`).toBeGreaterThanOrEqual(0);
      expect(limit, `${method} ${route}: orden sesión→límite`).toBeGreaterThan(identity);
      for (const read of ["request.json(", "request.text(", "await params", "await context.params", "searchParams", "new URL(request.url)"]) {
        const at = body.indexOf(read);
        if (at !== -1) expect(limit, `${method} ${route}: el límite debe ir antes de ${read}`).toBeLessThan(at);
      }
    }
  });

  it("el contacto de Conversations limita PATCH, PUT y DELETE dentro de authorize(), tras sesión y rol", () => {
    const src = source("conversations/[conversationId]/contact");
    const authorize = src.slice(src.indexOf("async function authorize"), src.indexOf("/** Ficha del contacto"));
    expect(authorize.indexOf("authorizeConversationsAccess(")).toBeLessThan(authorize.indexOf("rateLimitAuthenticatedUser("));
    expect(authorize.indexOf("rateLimitAuthenticatedUser(")).toBeLessThan(authorize.indexOf("await params"));
    expect(methodBody(src, "PATCH")).toContain('authorize(request, params, "conversation-contact-update")');
    expect(methodBody(src, "PUT")).toContain('authorize(request, params, "conversation-contact-update")');
    expect(methodBody(src, "DELETE")).toContain('authorize(request, params, "conversation-contact-delete")');
    expect(methodBody(src, "GET")).not.toContain("conversation-contact");
  });

  it("toda operación de la tabla tiene al menos una ruta, y viceversa", () => {
    const used = new Set(SENSITIVE.map((s) => s.operation));
    expect(new Set(Object.keys(SENSITIVE_RATE_LIMITS))).toEqual(used.add("conversation-contact-delete").add("conversation-contact-update"));
  });

  it("todos los límites son razonables y positivos", () => {
    for (const [operation, rule] of Object.entries(SENSITIVE_RATE_LIMITS)) {
      expect(rule.limit, operation).toBeGreaterThan(0);
      expect(rule.windowSeconds, operation).toBeGreaterThanOrEqual(60);
    }
    expect(SENSITIVE_RATE_LIMITS["conversation-send"]).toEqual({ limit: 30, windowSeconds: 60 });
    expect(SENSITIVE_RATE_LIMITS["conversation-template-test"]).toEqual({ limit: 5, windowSeconds: 60 });
    expect(SENSITIVE_RATE_LIMITS["auth-change-password"]).toEqual({ limit: 5, windowSeconds: 900 });
  });
});

describe("rutas que NO llevan este límite", () => {
  const NOT_LIMITED = [
    // máquina a máquina: autenticación propia y reintentos legítimos
    "webhooks/whatsapp",
    "webhooks/negative-review-alert",
    "cron/informe-diario",
    "cron/agent-daily-summaries",
    "integrations/make/daily-summary",
    "internal/render",
    // lecturas normales del dashboard
    "dashboard",
    "period",
    "resenas",
    "analisis-ia",
    "conversations",
    "conversations/report-options",
    "informes/negative-reviews",
    "informes/weekly-context",
    "informes/mensual",
    "platform/users/options",
    "restaurants/[slug]/weekly-trend",
    "restaurants/onboarding/options",
    "auth/check",
    "auth/logout",
    "company/select",
  ];

  it.each(NOT_LIMITED)("/api/%s no usa rateLimitAuthenticatedUser", (route) => {
    expect(existsSync(join(ROOT, "app/api", route, "route.ts"))).toBe(true);
    expect(source(route)).not.toContain("rateLimitAuthenticatedUser");
  });
});

describe("generate-negative-review-image (SEC-006) no tiene doble límite", () => {
  it("usa solo su propio consumeRateLimit, una vez, y no el helper de SEC-013", () => {
    const src = source("generate-negative-review-image");
    expect(src.match(/consumeRateLimit\(/g)).toHaveLength(1);
    expect(src).not.toContain("rateLimitAuthenticatedUser");
    expect(OTHER_RATE_LIMITED_OPERATIONS).toContain("negative-review-image");
    expect(Object.keys(SENSITIVE_RATE_LIMITS)).not.toContain("negative-review-image");
  });
});

describe("nada de límites por IP o por datos del cliente", () => {
  it("el helper no lee cabeceras ni IP y la clave es <operación>:<usuario>", () => {
    const helper = readFileSync(join(ROOT, "lib/security/rate-limit.server.ts"), "utf8");
    const fn = helper.slice(helper.indexOf("export async function rateLimitAuthenticatedUser"));
    expect(fn).toContain("`${operation}:${userId}`");
    expect(fn).not.toMatch(/headers\.get|x-forwarded|ip\b/i);
  });
});
