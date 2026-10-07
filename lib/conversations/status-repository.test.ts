import { beforeEach, describe, expect, it, vi } from "vitest";

type Filter = { op: "eq" | "in"; column: string; value: unknown };
type Table = Record<string, unknown>[];

let table: Table = [];
let log: { op: string; filters: Filter[]; values?: Record<string, unknown> }[] = [];
let failWith: { code: string } | null = null;

/** Cliente Supabase mínimo y encadenable sobre una tabla en memoria. */
function builder() {
  const state: { op: "select" | "update" | "insert"; values?: Record<string, unknown>; filters: Filter[] } = {
    op: "select",
    filters: [],
  };
  const matches = (row: Record<string, unknown>) =>
    state.filters.every((f) => (f.op === "eq" ? row[f.column] === f.value : (f.value as unknown[]).includes(row[f.column])));
  const run = () => {
    log.push({ op: state.op, filters: state.filters, values: state.values });
    if (failWith) return { data: null, error: failWith };
    if (state.op === "update") {
      const hit = table.filter(matches);
      hit.forEach((row) => Object.assign(row, state.values));
      return { data: hit.map((row) => ({ id: row.id })), error: null };
    }
    return { data: table.filter(matches).map((row) => ({ id: row.id })), error: null };
  };
  const api = {
    update: (values: Record<string, unknown>) => ((state.op = "update"), (state.values = values), api),
    insert: () => {
      throw new Error("applyStatus nunca debe insertar filas");
    },
    select: () => api,
    eq: (column: string, value: unknown) => (state.filters.push({ op: "eq", column, value }), api),
    in: (column: string, value: unknown[]) => (state.filters.push({ op: "in", column, value }), api),
    maybeSingle: async () => {
      const result = run();
      return { data: (result.data as unknown[] | null)?.[0] ?? null, error: result.error };
    },
    then: (resolve: (value: unknown) => unknown) => resolve(run()),
  };
  return api;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: () => builder() }) }));

const { messageStatusRepository } = await import("@/lib/conversations/status.server");

const row = (over: Record<string, unknown>) => ({
  id: "m1",
  canal_id: "canal-1",
  external_id: "wamid.OUT1",
  direction: "outbound",
  status: "sent",
  raw_payload: null,
  text: "texto privado",
  ...over,
});

const apply = (incoming: "sent" | "delivered" | "read" | "failed" | "deleted", wamid = "wamid.OUT1") =>
  messageStatusRepository.applyStatus({ canalId: "canal-1", externalMessageId: wamid, incoming });

beforeEach(() => {
  table = [row({})];
  log = [];
  failWith = null;
});

describe("messageStatusRepository.applyStatus", () => {
  it("hace una única actualización condicional por canal + wamid + saliente + estado permitido", async () => {
    expect(await apply("delivered")).toBe("updated");
    expect(table[0]!.status).toBe("delivered");

    expect(log).toHaveLength(1);
    expect(log[0]!.op).toBe("update");
    expect(log[0]!.filters).toEqual([
      { op: "eq", column: "canal_id", value: "canal-1" },
      { op: "eq", column: "external_id", value: "wamid.OUT1" },
      { op: "eq", column: "direction", value: "outbound" },
      { op: "in", column: "status", value: ["pending", "sent", "failed"] },
    ]);
  });

  it("solo escribe status y updated_at: nunca texto, raw_payload ni el error del proveedor", async () => {
    await apply("failed");
    expect(Object.keys(log[0]!.values!).sort()).toEqual(["status", "updated_at"]);
    expect(table[0]!.raw_payload).toBeNull();
    expect(table[0]!.text).toBe("texto privado");
  });

  it("estado repetido o más antiguo → unchanged (el mensaje existe pero no se toca)", async () => {
    table = [row({ status: "read" })];
    expect(await apply("delivered")).toBe("unchanged");
    expect(table[0]!.status).toBe("read");
    expect(await apply("read")).toBe("unchanged");
  });

  it("wamid desconocido → not_found sin crear filas", async () => {
    expect(await apply("delivered", "wamid.OTRO")).toBe("not_found");
    expect(table).toHaveLength(1);
  });

  it("un mensaje entrante con el mismo wamid no se modifica ni cuenta como encontrado", async () => {
    table = [row({ direction: "inbound", status: "received" })];
    expect(await apply("read")).toBe("not_found");
    expect(table[0]!.status).toBe("received");
  });

  it("un error de base de datos se lanza sin copiar valores de filas", async () => {
    failWith = { code: "08006" };
    await expect(apply("read")).rejects.toMatchObject({ name: "ConversationsDbError", code: "08006" });
    await expect(apply("read")).rejects.not.toMatchObject({ message: expect.stringContaining("wamid") });
  });
});
