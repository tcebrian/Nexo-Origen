import { describe, expect, it, vi } from "vitest";
import { isProtectedApiPath } from "@/lib/auth/route-guard";
import { installNetworkGuard } from "@/lib/render/network-guard";

type Handler = (route: { request: () => { url: () => string }; fallback: () => unknown; abort: (reason: string) => unknown }) => unknown;

function fakePage() {
  const routes: { pattern: string; handler: Handler }[] = [];
  return { page: { route: vi.fn(async (pattern: string, handler: Handler) => void routes.push({ pattern, handler })) }, routes };
}

function visit(handler: Handler, url: string) {
  const fallback = vi.fn();
  const abort = vi.fn();
  handler({ request: () => ({ url: () => url }), fallback, abort });
  return { allowed: fallback.mock.calls.length === 1, aborted: abort.mock.calls.map((call) => call[0]) };
}

describe("installNetworkGuard", () => {
  it("intercepta todas las peticiones y solo deja pasar el origen propio y data:", async () => {
    const { page, routes } = fakePage();
    await installNetworkGuard(page as never, "https://app.nexo.example");

    expect(routes).toHaveLength(1);
    expect(routes[0]!.pattern).toBe("**/*");
    const { handler } = routes[0]!;
    expect(visit(handler, "https://app.nexo.example/templates/x").allowed).toBe(true);
    expect(visit(handler, "data:image/png;base64,AAAA").allowed).toBe(true);
    expect(visit(handler, "https://evil.example/steal")).toEqual({ allowed: false, aborted: ["blockedbyclient"] });
    expect(visit(handler, "http://169.254.169.254/latest/meta-data/")).toEqual({ allowed: false, aborted: ["blockedbyclient"] });
  });

  it("sin origen permitido (informes con HTML incrustado) bloquea toda la red", async () => {
    const { page, routes } = fakePage();
    await installNetworkGuard(page as never, null);
    expect(visit(routes[0]!.handler, "https://app.nexo.example/x").allowed).toBe(false);
    expect(visit(routes[0]!.handler, "data:font/woff2;base64,AAAA").allowed).toBe(true);
  });
});

describe("route-guard: el renderer es la única ruta nueva sin sesión", () => {
  it("/api/internal/render se autentica por firma; el resto de /api sigue protegido", () => {
    expect(isProtectedApiPath("/api/internal/render")).toBe(false);
    for (const route of [
      "/api/informes/mensual/7",
      "/api/generate-negative-review-image",
      "/api/generate-network-summary-image",
      "/api/conversations/abc/reports",
      "/api/internal/otro",
    ]) {
      expect(isProtectedApiPath(route)).toBe(true);
    }
  });
});
