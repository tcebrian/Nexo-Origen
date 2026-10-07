/**
 * Cliente Supabase mínimo y encadenable sobre tablas en memoria, para probar la
 * resolución de alcances y la persistencia de Conversations sin base de datos.
 * Soporta lo que usan `fetchUserScope`, `fetchPerfilFresh` y las capas de
 * contactos / ingestión: select / insert / update / eq / in / not / or (sin
 * efecto) / order / limit / maybeSingle / single / rpc, además de restricciones
 * únicas simuladas (`db.uniques`). Las comparaciones son por texto (ids numéricos y uuid).
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

type Filter = { op: "eq" | "in" | "notnull"; column: string; value?: unknown };

export type UniqueRule = {
  columns: string[];
  constraint: string;
  /** Índice parcial: solo aplica si estas columnas no son nulas. */
  onlyWhenNotNull?: string[];
};

export type FakeDb = {
  tables: Tables;
  /** Fallos a inyectar por tabla (todas las operaciones sobre ella). */
  failures: Record<string, { code: string; message?: string }>;
  /** Restricciones únicas por tabla (23505 con el nombre de la restricción). */
  uniques: Record<string, UniqueRule[]>;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  rpcResult: { error: { code: string } | null };
  client: { from: (table: string) => unknown; rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> };
};

export function createFakeDb(initial: Tables = {}): FakeDb {
  const db: FakeDb = {
    tables: initial,
    failures: {},
    uniques: {},
    rpcCalls: [],
    rpcResult: { error: null },
    client: { from: () => null, rpc: async () => null },
  };
  let nextId = 1;

  function builder(table: string) {
    const state: { op: "select" | "update" | "insert"; values?: Row; filters: Filter[] } = { op: "select", filters: [] };
    const matches = (row: Row) =>
      state.filters.every((f) => {
        if (f.op === "notnull") return row[f.column] !== null && row[f.column] !== undefined;
        if (f.op === "eq") return String(row[f.column]) === String(f.value);
        return (f.value as unknown[]).some((v) => String(v) === String(row[f.column]));
      });

    const violates = (candidate: Row, ignore?: Row) =>
      (db.uniques[table] ?? []).find((rule) => {
        if (rule.onlyWhenNotNull?.some((column) => candidate[column] === null || candidate[column] === undefined)) return false;
        if (rule.columns.some((column) => candidate[column] === null || candidate[column] === undefined)) return false;
        return (db.tables[table] ?? []).some(
          (row) => row !== ignore && rule.columns.every((column) => String(row[column]) === String(candidate[column]))
        );
      });

    const unique = (rule: UniqueRule) => ({
      data: null,
      error: { code: "23505", message: `duplicate key value violates unique constraint "${rule.constraint}"` },
    });

    const run = () => {
      const failure = db.failures[table];
      if (failure) return { data: null, error: failure };
      const rows = (db.tables[table] ??= []);

      if (state.op === "insert") {
        const row: Row = { id: `${table}-${nextId++}`, ...state.values };
        const rule = violates(row);
        if (rule) return unique(rule);
        rows.push(row);
        return { data: [{ ...row }], error: null };
      }

      if (state.op === "update") {
        const hit = rows.filter(matches);
        for (const row of hit) {
          const rule = violates({ ...row, ...state.values }, row);
          if (rule) return unique(rule);
        }
        hit.forEach((row) => Object.assign(row, state.values));
        return { data: hit.map((row) => ({ ...row })), error: null };
      }

      return { data: rows.filter(matches).map((row) => ({ ...row })), error: null };
    };

    const first = (required: boolean) => async () => {
      const result = run();
      const row = (result.data as Row[] | null)?.[0] ?? null;
      if (result.error) return { data: null, error: result.error };
      return { data: row, error: row || !required ? null : { code: "PGRST116" } };
    };

    const api = {
      select: () => api,
      insert: (values: Row) => ((state.op = "insert"), (state.values = values), api),
      update: (values: Row) => ((state.op = "update"), (state.values = values), api),
      eq: (column: string, value: unknown) => (state.filters.push({ op: "eq", column, value }), api),
      in: (column: string, value: unknown[]) => (state.filters.push({ op: "in", column, value }), api),
      not: (column: string) => (state.filters.push({ op: "notnull", column }), api),
      or: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: first(false),
      single: first(true),
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
