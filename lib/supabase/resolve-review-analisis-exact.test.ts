import { describe, expect, it, vi } from "vitest";

const queries: { table: string; column: string; value: unknown; limit: number }[] = [];
let response: { data: unknown[] | null; error: unknown } = { data: [], error: null };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/data-client", () => ({
  getSupabaseDataClientForServer: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          limit: async (limit: number) => {
            queries.push({ table, column, value, limit });
            return response;
          },
        }),
      }),
    }),
  }),
}));

const { fetchAnalisisIaByReviewId } = await import("./analisis-ia.server");

describe("fetchAnalisisIaByReviewId (SEC-007: coincidencia exacta)", () => {
  it("hace UNA consulta con el id exacto: no prueba su forma numérica (1e3 ≠ 1000)", async () => {
    queries.length = 0;
    response = { data: [], error: null };
    expect(await fetchAnalisisIaByReviewId("  1e3 ")).toEqual({ analisis: null, error: null });
    expect(queries).toEqual([{ table: "analisis_ia", column: "review_id", value: "1e3", limit: 1 }]);
  });

  it("devuelve el análisis normalizado si existe", async () => {
    response = { data: [{ review_id: "abc", resumen: "Servicio lento", motivo: "Tiempo de espera" }], error: null };
    const result = await fetchAnalisisIaByReviewId("abc");
    expect(result.error).toBeNull();
    expect(result.analisis).toMatchObject({ review_id: "abc", resumen: "Servicio lento" });
  });

  it("id vacío → sin consulta", async () => {
    queries.length = 0;
    expect((await fetchAnalisisIaByReviewId("  ")).analisis).toBeNull();
    expect(queries).toHaveLength(0);
  });
});
