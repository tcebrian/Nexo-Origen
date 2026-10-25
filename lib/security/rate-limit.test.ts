import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null }));

const { consumeRateLimit, resetMemoryRateLimit } = await import("./rate-limit.server");

const OPTIONS = { limit: 3, windowSeconds: 60 };

/** Simula `nexo_rate_limit_hit`: contador por cubo. */
function fakeDb() {
  const counts = new Map<string, number>();
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, ...args });
        const hits = (counts.get(String(args.p_bucket)) ?? 0) + 1;
        counts.set(String(args.p_bucket), hits);
        return { data: [{ allowed: hits <= Number(args.p_limit), current_hits: hits, retry_after_seconds: 42 }], error: null };
      },
    },
  };
}

beforeEach(() => {
  resetMemoryRateLimit();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("consumeRateLimit (base de datos)", () => {
  it("permite hasta el límite y deniega después, con Retry-After", async () => {
    const { client } = fakeDb();
    for (let i = 0; i < 3; i++) expect((await consumeRateLimit("u:A", OPTIONS, { client })).allowed).toBe(true);
    expect(await consumeRateLimit("u:A", OPTIONS, { client })).toEqual({ allowed: false, retryAfterSeconds: 42 });
  });

  it("cada cubo es independiente: A no consume el cupo de B", async () => {
    const { client } = fakeDb();
    for (let i = 0; i < 5; i++) await consumeRateLimit("u:A", OPTIONS, { client });
    expect((await consumeRateLimit("u:A", OPTIONS, { client })).allowed).toBe(false);
    expect((await consumeRateLimit("u:B", OPTIONS, { client })).allowed).toBe(true);
  });

  it("pasa a la función el cubo, el límite y la ventana", async () => {
    const { client, calls } = fakeDb();
    await consumeRateLimit("u:A", OPTIONS, { client });
    expect(calls[0]).toEqual({ fn: "nexo_rate_limit_hit", p_bucket: "u:A", p_limit: 3, p_window_seconds: 60 });
  });
});

describe("consumeRateLimit (respaldo en memoria)", () => {
  const failing = { rpc: async () => ({ data: null, error: { code: "42883" } }) };
  const throwing = {
    rpc: async () => {
      throw new Error("red");
    },
  };

  it.each([
    ["sin cliente", null],
    ["la función no existe todavía", failing],
    ["la llamada lanza", throwing],
  ])("%s → sigue limitando en memoria", async (_name, client) => {
    for (let i = 0; i < 3; i++) expect((await consumeRateLimit("u:A", OPTIONS, { client })).allowed).toBe(true);
    const denied = await consumeRateLimit("u:A", OPTIONS, { client });
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect((await consumeRateLimit("u:B", OPTIONS, { client })).allowed).toBe(true);
  });

  it("la ventana se renueva", async () => {
    let now = 1_000_000_000_000;
    const deps = { client: null, now: () => now };
    for (let i = 0; i < 4; i++) await consumeRateLimit("u:A", OPTIONS, deps);
    expect((await consumeRateLimit("u:A", OPTIONS, deps)).allowed).toBe(false);
    now += 61_000;
    expect((await consumeRateLimit("u:A", OPTIONS, deps)).allowed).toBe(true);
  });

  it("no escribe la clave (lleva el id de usuario) en los logs", async () => {
    await consumeRateLimit("negative-review-image:USER-123", OPTIONS, { client: failing });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("USER-123");
  });
});
