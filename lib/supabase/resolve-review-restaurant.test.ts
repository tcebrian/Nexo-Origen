import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/data-client", () => ({ getSupabaseDataClientForServer: vi.fn() }));

const { resolveReviewRestaurant } = await import("./resenas.server");

type Result = { data: unknown[] | null; error: unknown };

/** Cliente falso que registra la consulta y devuelve lo indicado. */
function fakeClient(result: Result | (() => Promise<Result>)) {
  const calls: { table: string; columns: string; column: string; value: string; limit: number }[] = [];
  return {
    calls,
    client: {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => ({
            limit: async (limit: number) => {
              calls.push({ table, columns, column, value, limit });
              return typeof result === "function" ? result() : result;
            },
          }),
        }),
      }),
    },
  };
}

const rows = (...items: Record<string, unknown>[]): Result => ({ data: items, error: null });

describe("resolveReviewRestaurant (review_id → reseña → restaurante)", () => {
  it("reseña única con restaurante → ok", async () => {
    const { client } = fakeClient(rows({ id: 10, restaurante_id: 7 }));
    expect(await resolveReviewRestaurant("abc", client)).toEqual({ ok: true, restauranteId: 7 });
  });

  it("acepta restaurante_id como texto numérico (bigint)", async () => {
    const { client } = fakeClient(rows({ id: 10, restaurante_id: "42" }));
    expect(await resolveReviewRestaurant("abc", client)).toEqual({ ok: true, restauranteId: 42 });
  });

  it("consulta EXACTA y única: review_id = id recortado, límite 2, sin variantes numéricas ni por id", async () => {
    const { client, calls } = fakeClient(rows({ id: 10, restaurante_id: 7 }));
    await resolveReviewRestaurant("  1e3  ", client);
    expect(calls).toEqual([{ table: "resenas", columns: "id,restaurante_id", column: "review_id", value: "1e3", limit: 2 }]);
  });

  it("no encontrada → not_found (y no prueba otras formas del identificador)", async () => {
    const { client, calls } = fakeClient(rows());
    expect(await resolveReviewRestaurant("12345", client)).toEqual({ ok: false, reason: "not_found" });
    expect(calls).toHaveLength(1);
  });

  it("data null o id vacío → not_found", async () => {
    expect(await resolveReviewRestaurant("x", fakeClient({ data: null, error: null }).client)).toEqual({ ok: false, reason: "not_found" });
    const { client, calls } = fakeClient(rows({ id: 1, restaurante_id: 1 }));
    expect(await resolveReviewRestaurant("   ", client)).toEqual({ ok: false, reason: "not_found" });
    expect(calls).toHaveLength(0);
  });

  it.each([null, undefined, "", 0, -3, "abc", 1.5, NaN])("restaurante_id %s → no_restaurant", async (value) => {
    const { client } = fakeClient(rows({ id: 10, restaurante_id: value }));
    expect(await resolveReviewRestaurant("abc", client)).toEqual({ ok: false, reason: "no_restaurant" });
  });

  it("review_id duplicado → ambiguous, aunque ambas apunten al mismo restaurante (no se elige ninguna)", async () => {
    const same = fakeClient(rows({ id: 1, restaurante_id: 7 }, { id: 2, restaurante_id: 7 }));
    expect(await resolveReviewRestaurant("abc", same.client)).toEqual({ ok: false, reason: "ambiguous" });
    const different = fakeClient(rows({ id: 1, restaurante_id: 7 }, { id: 2, restaurante_id: 9 }));
    expect(await resolveReviewRestaurant("abc", different.client)).toEqual({ ok: false, reason: "ambiguous" });
  });

  it("error de Supabase o excepción → db_error (no se confunde con 'no existe')", async () => {
    expect(await resolveReviewRestaurant("abc", fakeClient({ data: null, error: { code: "57014", message: "timeout" } }).client)).toEqual({
      ok: false,
      reason: "db_error",
    });
    expect(
      await resolveReviewRestaurant(
        "abc",
        fakeClient(async () => {
          throw new Error("red");
        }).client
      )
    ).toEqual({ ok: false, reason: "db_error" });
  });
});
