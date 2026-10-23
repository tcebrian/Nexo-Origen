import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSuperAdminApiPath } from "@/lib/auth/route-guard";
import type { AuthSession, UserRole } from "@/lib/auth/types";

/**
 * SEC-002 — `/api/generate-network-summary-image` es solo super_admin. Se prueba la ruta REAL con la sesión
 * simulada: sin autorización no debe llegar a renderizar (y, por tanto, nunca a `fetchNetworkSummaryReport`).
 */

const getAuthSession = vi.fn();
const renderViaInternal = vi.fn();
const fetchNetworkSummaryReport = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/render/internal-render-client", () => ({ renderViaInternal }));
vi.mock("@/lib/reports/network-summary/fetch", () => ({ fetchNetworkSummaryReport }));

const route = await import("@/app/api/generate-network-summary-image/route");

function session(rol: UserRole | string, empresaId: string | null): AuthSession {
  return {
    userId: "u1",
    email: "u@example.com",
    perfil: { id: "u1", userId: "u1", rol, nombre: null, email: null, empresaId, mustChangePassword: false },
    scope: { rol, empresaId, empresaNombre: null, marcaIds: [], restauranteIds: [], brandIds: [] },
    assignedRestaurants: [],
    companies: [],
    activeCompany: null,
  } as unknown as AuthSession;
}

const call = (query: string) =>
  route.GET(new Request(`https://nexo.example/api/generate-network-summary-image?${query}`));

beforeEach(() => {
  vi.resetAllMocks();
  renderViaInternal.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

function expectNothingRendered() {
  expect(renderViaInternal).not.toHaveBeenCalled();
  expect(fetchNetworkSummaryReport).not.toHaveBeenCalled();
}

describe("GET /api/generate-network-summary-image — autorización", () => {
  it("sin sesión → 401", async () => {
    getAuthSession.mockResolvedValue(null);
    expect((await call("periodo=mensual&grupo=hambar")).status).toBe(401);
    expectNothingRendered();
  });

  it.each([
    ["restaurante_user", "2"],
    ["marca_admin", "2"], // supervisor / administrador de marca
    ["empresa_admin", "2"],
    ["manager", "2"], // alias heredado de marca_admin
    ["rol_desconocido", "2"],
  ])("%s → 403 y no renderiza", async (rol, empresa) => {
    getAuthSession.mockResolvedValue(session(rol, empresa));
    expect((await call("periodo=mensual&grupo=hambar")).status).toBe(403);
    expectNothingRendered();
  });

  it("usuario de Vault pidiendo grupo=hambar → 403", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", "2")); // Vault
    expect((await call("periodo=mensual&grupo=hambar&offset=0")).status).toBe(403);
    expectNothingRendered();
  });

  it("usuario de Hambar (no super_admin) pidiendo grupo=vault → 403", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", "1")); // Hambar
    expect((await call("periodo=mensual&grupo=vault")).status).toBe(403);
    expectNothingRendered();
  });

  it.each(["HAMBAR", "Vault", "hambar%20", "inexistente", "", "../hambar"])(
    "no super_admin con grupo=%s → 403 (la autorización va antes de validar el grupo)",
    async (grupo) => {
      getAuthSession.mockResolvedValue(session("restaurante_user", "1"));
      expect((await call(`periodo=mensual&grupo=${grupo}`)).status).toBe(403);
      expectNothingRendered();
    }
  );

  it("parámetros adicionales (empresa, scope, rol, admin) no conceden nada", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", "2"));
    const res = await call("periodo=mensual&grupo=hambar&empresa=1&empresaId=1&rol=super_admin&admin=true&marca=bk");
    expect(res.status).toBe(403);
    expectNothingRendered();
  });

  it("super_admin → permitido, y el grupo lo valida el servidor", async () => {
    getAuthSession.mockResolvedValue(session("super_admin", null));
    const ok = await call("periodo=mensual&grupo=hambar&offset=0");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(renderViaInternal).toHaveBeenCalledWith({ op: "network_summary_image", periodo: "mensual", grupo: "hambar", offset: 0 });

    expect((await call("periodo=mensual&grupo=HAMBAR")).status).toBe(400);
    expect((await call("periodo=mensual&grupo=inexistente")).status).toBe(400);
    expect((await call("periodo=anual&grupo=hambar")).status).toBe(400);
    expect(renderViaInternal).toHaveBeenCalledTimes(1);
  });
});

describe("route-guard", () => {
  it("la ruta está en las rutas solo super_admin (middleware y requireApiAuth)", () => {
    expect(isSuperAdminApiPath("/api/generate-network-summary-image")).toBe(true);
  });

  it("generate-negative-review-image NO se restringe aquí (SEC-006): lo usa el modal de reseñas de todos los roles", () => {
    expect(isSuperAdminApiPath("/api/generate-negative-review-image")).toBe(false);
  });
});

describe("defensa en profundidad: la ruta se protege sola", () => {
  it("aunque requireApiAuth/middleware dejaran pasar a cualquier sesión, un no super_admin recibe 403", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/api-auth", () => ({
      requireApiAuth: async () => ({ ok: true, session: session("empresa_admin", "2") }),
    }));
    const isolated = await import("@/app/api/generate-network-summary-image/route");
    const res = await isolated.GET(
      new Request("https://nexo.example/api/generate-network-summary-image?periodo=mensual&grupo=hambar")
    );
    expect(res.status).toBe(403);
    expectNothingRendered();
    vi.doUnmock("@/lib/auth/api-auth");
  });
});
