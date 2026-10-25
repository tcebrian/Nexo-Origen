import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession, UserRole } from "@/lib/auth/types";

/**
 * SEC-014 — `GET /api/resenas` ejecutada de verdad: el usuario de una empresa no recibe reseñas de la otra, ni
 * siquiera pidiendo directamente el id de un restaurante ajeno. Solo se simulan la sesión y la lectura de reseñas
 * (que aquí devuelve a propósito filas de AMBAS empresas, como haría la consulta sin filtrar en SQL).
 */

const getAuthSession = vi.fn();
const fetchResenasForPeriodServer = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/supabase/resenas.server", () => ({ fetchResenasForPeriodServer }));

const route = await import("./route");

const HAMBAR = [1, 2, 3];
const VAULT = [10, 11];
const ALL_ROWS = [...HAMBAR, ...VAULT].map((restaurante_id) => ({ id: restaurante_id * 100, restaurante_id, estrellas: 5 }));

function session(rol: UserRole, restauranteIds: number[] | null): AuthSession {
  return {
    userId: "u1",
    email: "u@example.com",
    perfil: { id: "u1", userId: "u1", rol, nombre: null, email: null, empresaId: "1", mustChangePassword: false },
    scope: { rol, empresaId: "1", empresaNombre: null, marcaIds: restauranteIds === null ? null : [], restauranteIds, brandIds: restauranteIds === null ? null : [] },
    assignedRestaurants: [],
    companies: [],
    activeCompany: null,
  };
}

function call(query: string) {
  return route.GET(new Request(`http://localhost/api/resenas?start=2026-10-01&end=2026-10-07${query}`));
}

beforeEach(() => {
  getAuthSession.mockReset();
  fetchResenasForPeriodServer.mockReset();
  fetchResenasForPeriodServer.mockResolvedValue(ALL_ROWS);
});

describe("GET /api/resenas — aislamiento entre empresas", () => {
  it("sin sesión → 401 y no se lee nada", async () => {
    getAuthSession.mockResolvedValue(null);
    expect((await call("")).status).toBe(401);
    expect(fetchResenasForPeriodServer).not.toHaveBeenCalled();
  });

  it("usuario de Hambar → solo reseñas de Hambar", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", HAMBAR));
    const response = await call("");
    const rows = (await response.json()) as { restaurante_id: number }[];
    expect(response.status).toBe(200);
    expect(rows.map((r) => r.restaurante_id).sort()).toEqual(HAMBAR);
  });

  it("usuario de Vault → solo reseñas de Vault", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", VAULT));
    const rows = (await (await call("")).json()) as { restaurante_id: number }[];
    expect(rows.map((r) => r.restaurante_id).sort()).toEqual(VAULT);
  });

  it("pedir el restaurante_id de la otra empresa → 403 sin consultar datos", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", HAMBAR));
    const response = await call("&restaurante_id=10");
    expect(response.status).toBe(403);
    expect(fetchResenasForPeriodServer).not.toHaveBeenCalled();

    getAuthSession.mockResolvedValue(session("restaurante_user", VAULT));
    expect((await call("&restaurante_id=1")).status).toBe(403);
    expect(fetchResenasForPeriodServer).not.toHaveBeenCalled();
  });

  it("usuario sin ningún restaurante asignado → nada, ni pidiendo ids concretos", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", []));
    expect(await (await call("")).json()).toEqual([]);
    expect((await call("&restaurante_id=1")).status).toBe(403);
  });

  it("super_admin sin empresa activa conserva el alcance administrativo; acotado a una empresa, solo ve esa", async () => {
    getAuthSession.mockResolvedValue(session("super_admin", null));
    const all = (await (await call("")).json()) as unknown[];
    expect(all).toHaveLength(ALL_ROWS.length);

    getAuthSession.mockResolvedValue(session("super_admin", VAULT));
    const rows = (await (await call("")).json()) as { restaurante_id: number }[];
    expect(rows.map((r) => r.restaurante_id).sort()).toEqual(VAULT);
    expect((await call("&restaurante_id=1")).status).toBe(403);
  });
});
