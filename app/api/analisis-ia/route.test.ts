import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession, UserRole } from "@/lib/auth/types";

/**
 * SEC-007 — `GET /api/analisis-ia` falla cerrada. Se ejecuta la ruta REAL y el resolvedor REAL contra una base de
 * datos falsa; solo se simula la sesión y la lectura de `analisis_ia`, para comprobar que NO se consulta nunca si
 * no se ha demostrado review_id → reseña → restaurante → permiso.
 */

type ResenaRow = { id: number; review_id: string; restaurante_id: number | null };

const getAuthSession = vi.fn();
const fetchAnalisisIaByReviewId = vi.fn();
let resenas: ResenaRow[] = [];
let dbError: unknown = null;
let dbThrows = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/supabase/analisis-ia.server", () => ({ fetchAnalisisIaByReviewId }));
vi.mock("@/lib/supabase/data-client", () => ({
  getSupabaseDataClientForServer: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          limit: async (limit: number) => {
            if (dbThrows) throw new Error("conexión rota: secreto-interno");
            if (dbError) return { data: null, error: dbError };
            return { data: resenas.filter((r) => table === "resenas" && column === "review_id" && r.review_id === value).slice(0, limit), error: null };
          },
        }),
      }),
    }),
  }),
}));

const route = await import("./route");

const HAMBAR_RESTAURANT = 5;
const VAULT_RESTAURANT = 30;
const ANALISIS = { review_id: "rev-hambar", resumen: "Servicio lento", motivo: "Tiempo de espera" };

function session(rol: UserRole, restauranteIds: number[] | null): AuthSession {
  return {
    userId: "u1",
    email: "u@example.com",
    perfil: { id: "u1", userId: "u1", rol, nombre: null, email: null, empresaId: "1", mustChangePassword: false },
    scope: { rol, empresaId: "1", empresaNombre: null, marcaIds: restauranteIds === null ? null : [], restauranteIds, brandIds: restauranteIds === null ? null : [] },
    assignedRestaurants: [],
    companies: [],
    activeCompany: null,
  } as unknown as AuthSession;
}

const get = (reviewId?: string) =>
  route.GET(new Request(`https://nexo.example/api/analisis-ia${reviewId === undefined ? "" : `?review_id=${encodeURIComponent(reviewId)}`}`));

beforeEach(() => {
  vi.resetAllMocks();
  resenas = [
    { id: 1, review_id: "rev-hambar", restaurante_id: HAMBAR_RESTAURANT },
    { id: 2, review_id: "rev-vault", restaurante_id: VAULT_RESTAURANT },
    { id: 3, review_id: "rev-sin-restaurante", restaurante_id: null },
  ];
  dbError = null;
  dbThrows = false;
  getAuthSession.mockResolvedValue(session("empresa_admin", [HAMBAR_RESTAURANT]));
  fetchAnalisisIaByReviewId.mockResolvedValue({ analisis: ANALISIS, error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const expectAnalysisNeverQueried = () => expect(fetchAnalisisIaByReviewId).not.toHaveBeenCalled();

describe("autenticación y entrada", () => {
  it("sin sesión → 401 y no consulta nada", async () => {
    getAuthSession.mockResolvedValue(null);
    expect((await get("rev-hambar")).status).toBe(401);
    expectAnalysisNeverQueried();
  });

  it.each([[undefined], [""], ["   "], ["x".repeat(201)]])("review_id ausente o inválido (%s) → 400", async (value) => {
    expect((await get(value)).status).toBe(400);
    expectAnalysisNeverQueried();
  });
});

describe("caso permitido", () => {
  it("reseña de un restaurante dentro del scope → 200 con el análisis", async () => {
    const res = await get("rev-hambar");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ analisis: ANALISIS, error: null });
    expect(fetchAnalisisIaByReviewId).toHaveBeenCalledWith("rev-hambar");
  });

  it("super_admin con una reseña válida → 200 (se salta el filtro de restaurante)", async () => {
    getAuthSession.mockResolvedValue(session("super_admin", null));
    expect((await get("rev-vault")).status).toBe(200);
    expect(fetchAnalisisIaByReviewId).toHaveBeenCalledWith("rev-vault");
  });
});

describe("fuera de alcance", () => {
  it("reseña de otro restaurante → 403 y no consulta analisis_ia", async () => {
    expect((await get("rev-vault")).status).toBe(403);
    expectAnalysisNeverQueried();
  });

  it("un usuario de Vault no puede obtener el análisis de una reseña de Hambar", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin", [VAULT_RESTAURANT, 31]));
    const res = await get("rev-hambar");
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("Servicio lento");
    expectAnalysisNeverQueried();
  });

  it("un usuario sin restaurantes (scope vacío) → 403", async () => {
    getAuthSession.mockResolvedValue(session("restaurante_user", []));
    expect((await get("rev-hambar")).status).toBe(403);
    expectAnalysisNeverQueried();
  });
});

describe("fail closed: no se puede demostrar el restaurante", () => {
  it("review_id inexistente → 404", async () => {
    expect((await get("no-existe")).status).toBe(404);
    expectAnalysisNeverQueried();
  });

  it("análisis huérfano (hay análisis pero no reseña) → 404 y no se consulta, ni siquiera para super_admin", async () => {
    getAuthSession.mockResolvedValue(session("super_admin", null));
    const res = await get("analisis-huerfano");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ analisis: null, error: "Reseña no disponible" });
    expectAnalysisNeverQueried();
  });

  it.each([
    ["empresa_admin", [HAMBAR_RESTAURANT]],
    ["super_admin", null],
  ] as [UserRole, number[] | null][])("reseña con restaurante_id nulo (%s) → 404 y no se consulta", async (rol, ids) => {
    getAuthSession.mockResolvedValue(session(rol, ids));
    expect((await get("rev-sin-restaurante")).status).toBe(404);
    expectAnalysisNeverQueried();
  });

  it("review_id duplicado → no devuelve datos ni elige una reseña (ni siquiera super_admin)", async () => {
    resenas.push({ id: 9, review_id: "rev-hambar", restaurante_id: VAULT_RESTAURANT });
    for (const s of [session("empresa_admin", [HAMBAR_RESTAURANT]), session("super_admin", null)]) {
      getAuthSession.mockResolvedValue(s);
      expect((await get("rev-hambar")).status).toBe(409);
    }
    expectAnalysisNeverQueried();
  });

  it("error de Supabase al resolver → 503 genérico, sin su mensaje, y no se consulta", async () => {
    dbError = { code: "57014", message: "canceling statement: relation resenas secreto-interno" };
    const res = await get("rev-hambar");
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("secreto-interno");
    expectAnalysisNeverQueried();
  });

  it("excepción al resolver → 503 genérico y no se consulta", async () => {
    dbThrows = true;
    const res = await get("rev-hambar");
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("secreto-interno");
    expectAnalysisNeverQueried();
  });

  it("ninguna variante del identificador resuelve otra reseña (p. ej. 1e3 / 0001 / id numérico)", async () => {
    resenas.push({ id: 1000, review_id: "1000", restaurante_id: HAMBAR_RESTAURANT });
    for (const probe of ["1e3", "01000", "1000.0", "1", "2"]) expect((await get(probe)).status).toBe(404);
    expectAnalysisNeverQueried();
    expect((await get("1000")).status).toBe(200);
  });
});
