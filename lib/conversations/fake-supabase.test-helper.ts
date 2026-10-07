/**
 * Cliente Supabase mínimo y encadenable sobre tablas en memoria, para probar la
 * resolución de alcances sin base de datos. Soporta lo que usan `fetchUserScope`,
 * `fetchPerfilFresh` y la capa de contactos: select / eq / in / not / order /
 * maybeSingle / update / rpc. Las comparaciones son por texto (ids numéricos y uuid).
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

type Filter = { op: "eq" | "in" | "notnull"; column: string; value?: unknown };

export type FakeDb = {
  tables: Tables;
  /** Fallos a inyectar por tabla (todas las operaciones sobre ella). */
  failures: Record<string, { code: string; message?: string }>;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  rpcResult: { error: { code: string } | null };
  client: { from: (table: string) => unknown; rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> };
};

export function createFakeDb(initial: Tables = {}): FakeDb {
  const db: FakeDb = {
    tables: initial,
    failures: {},
    rpcCalls: [],
    rpcResult: { error: null },
    client: { from: () => null, rpc: async () => null },
  };

  function builder(table: string) {
    const state: { op: "select" | "update"; values?: Row; filters: Filter[] } = { op: "select", filters: [] };
    const matches = (row: Row) =>
      state.filters.every((f) => {
        if (f.op === "notnull") return row[f.column] !== null && row[f.column] !== undefined;
        if (f.op === "eq") return String(row[f.column]) === String(f.value);
        return (f.value as unknown[]).some((v) => String(v) === String(row[f.column]));
      });
    const run = () => {
      const failure = db.failures[table];
      if (failure) return { data: null, error: failure };
      const rows = db.tables[table] ?? [];
      if (state.op === "update") {
        const hit = rows.filter(matches);
        hit.forEach((row) => Object.assign(row, state.values));
        return { data: hit, error: null };
      }
      return { data: rows.filter(matches).map((row) => ({ ...row })), error: null };
    };
    const api = {
      select: () => api,
      update: (values: Row) => ((state.op = "update"), (state.values = values), api),
      eq: (column: string, value: unknown) => (state.filters.push({ op: "eq", column, value }), api),
      in: (column: string, value: unknown[]) => (state.filters.push({ op: "in", column, value }), api),
      not: (column: string) => (state.filters.push({ op: "notnull", column }), api),
      order: () => api,
      maybeSingle: async () => {
        const result = run();
        return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error };
      },
      then: (resolve: (value: unknown) => unknown) => resolve(run()),
    };
    return api;
  }

  db.client = {
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ fn, args });
      return { data: null, error: db.rpcResult.error };
    },
  };
  return db;
}
