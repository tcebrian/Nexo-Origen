import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SEC-001 — la clave pública `anon` no puede leer datos de negocio.
 * Estas pruebas son estáticas (no hay base de datos en CI): comprueban el contenido de la migración y que el
 * navegador no depende de acceso directo a esas tablas. La prueba contra la base real es
 * `supabase/sec_001_verify.sql`.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const MIGRATION = read("supabase/sec_001_revoke_anon_data_access.sql");
const ROLLBACK = read("supabase/sec_001_revoke_anon_data_access_rollback.sql");

/** SQL sin comentarios, para no confundir la explicación con instrucciones. */
const sqlOf = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
const MIGRATION_SQL = sqlOf(MIGRATION);

const TABLES = ["resenas", "restaurantes", "marcas", "kpi_diario", "kpi_semanal", "kpi_mensual"];
const VIEWS = [
  "dashboard_kpis",
  "dashboard_restaurantes",
  "kpi_marcas",
  "kpi_restaurantes",
  "resumen_restaurantes",
  "v_motivos_base",
  "motivos_diarios",
  "motivos_semanales",
  "motivos_mensuales",
];
const RPCS = [
  "get_kpis_periodo(bigint, date, date)",
  "nexo_window_reviews(timestamp, timestamp, bigint[])",
  "nexo_reputation_window_metrics(timestamp, timestamp, bigint[])",
];

describe("SEC-001 migración", () => {
  it.each(TABLES)("elimina la política pública de %s", (table) => {
    expect(MIGRATION_SQL).toContain(`drop policy if exists "Allow anon read ${table}" on public.${table};`);
  });

  it("revoca todo a public, anon y authenticated en cada tabla y vista", () => {
    expect(MIGRATION_SQL).toContain("revoke all on table public.%I from public, anon, authenticated");
    for (const name of [...TABLES, ...VIEWS]) expect(MIGRATION_SQL).toContain(`'${name}'`);
  });

  it("pone las vistas en security_invoker (no son bypass de RLS)", () => {
    expect(MIGRATION_SQL).toContain("set (security_invoker = true)");
  });

  it.each(RPCS)("revoca EXECUTE de %s a public, anon y authenticated y lo deja a service_role", (rpc) => {
    expect(MIGRATION_SQL).toContain(`revoke execute on function public.${rpc} from public, anon, authenticated;`);
    expect(MIGRATION_SQL).toContain(`grant execute on function public.${rpc} to service_role;`);
  });

  it("no toca perfiles, service_role como destino de REVOKE, SEC-005 ni datos", () => {
    expect(MIGRATION_SQL).not.toMatch(/perfiles/);
    expect(MIGRATION_SQL).not.toMatch(/revoke[^;]*service_role/i);
    expect(MIGRATION_SQL).not.toMatch(/nexo_call_daily_report_cron|nexo_notify_negative_review_alert/);
    expect(MIGRATION_SQL).not.toMatch(/\b(insert|update|delete|truncate)\s+(into|from)?\s*public\./i);
  });

  it("es transaccional", () => {
    expect(MIGRATION_SQL.trim().startsWith("begin;")).toBe(true);
    expect(MIGRATION_SQL.trim().endsWith("commit;")).toBe(true);
  });

  it("el rollback restaura políticas, privilegios, vistas y RPC", () => {
    const rollback = sqlOf(ROLLBACK);
    for (const table of TABLES) {
      expect(rollback).toContain(`create policy "Allow anon read ${table}" on public.${table} for select to anon using (true);`);
    }
    expect(rollback).toContain("reset (security_invoker)");
    for (const rpc of RPCS) expect(rollback).toContain(`grant execute on function public.${rpc} to public, anon, authenticated;`);
  });

  it("el script de verificación no deja cambios (termina en rollback) y cubre perfiles", () => {
    const verify = sqlOf(read("supabase/sec_001_verify.sql"));
    expect(verify.trim().endsWith("rollback;")).toBe(true);
    expect(verify).toContain("perfiles_select_own");
    expect(verify).toContain("set local role anon");
  });
});

describe("SEC-001 el navegador no lee datos de negocio directamente", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      if (entry === "node_modules" || entry === ".next") return [];
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
    });
  }

  // Únicos módulos que pueden usar el cliente de navegador de Supabase: autenticación (login, logout) y su
  // propio perfil (`verifyPerfilForUser`, lectura de `perfiles` con la política perfiles_select_own).
  const ALLOWED = new Set([
    "app/login/login-form.tsx",
    "app/dashboard/_components/use-logout.ts",
    "app/test-supabase/page.tsx", // solo desarrollo: redirige en producción
    "lib/supabase.ts",
    "lib/supabase/admin.ts", // getSupabaseDataClient: sin usos (se vigila abajo)
  ]);

  it("solo login/logout (auth) importan el cliente de navegador", () => {
    const offenders = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "lib"))]
      .filter((file) => /from "@\/lib\/supabase(\/client)?"/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).split(sep).join("/"))
      .filter((file) => !ALLOWED.has(file));
    expect(offenders).toEqual([]);
  });

  it("el cliente de navegador no consulta tablas de negocio", () => {
    const business = /\.from\(\s*["'`](resenas|restaurantes|marcas|kpi_[a-z]+|dashboard_[a-z]+|resumen_restaurantes|motivos_[a-z]+|v_motivos_base)["'`]/;
    for (const file of ["app/login/login-form.tsx", "app/dashboard/_components/use-logout.ts"]) {
      expect(read(file)).not.toMatch(business);
      expect(read(file)).not.toMatch(/\.rpc\(/);
    }
  });

  it("getSupabaseDataClient (cliente anon en navegador) no tiene usos", () => {
    const users = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "lib"))]
      .filter((file) => /getSupabaseDataClient\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).split(sep).join("/"));
    expect(users).toEqual(["lib/supabase/admin.ts"]);
  });
});
