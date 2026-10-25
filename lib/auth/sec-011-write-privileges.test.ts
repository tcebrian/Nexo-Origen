import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SEC-011 — `anon`/`authenticated` sin privilegios de escritura sobre tablas de negocio. Pruebas estáticas del SQL (no
 * hay base de datos en CI); la prueba real es `supabase/sec_011_verify.sql`.
 */
const ROOT = process.cwd();
// Normaliza los saltos de línea: en Windows Git puede dejar los ficheros con CRLF.
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const sqlOf = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

const MIGRATION = sqlOf(read("supabase/sec_011_revoke_write_privileges.sql"));
const ROLLBACK = sqlOf(read("supabase/sec_011_revoke_write_privileges_rollback.sql"));
const ROLLBACK_RAW = read("supabase/sec_011_revoke_write_privileges_rollback.sql");
const VERIFY = sqlOf(read("supabase/sec_011_verify.sql"));

const TABLES = [
  "alertas_enviadas",
  "analisis_ia",
  "conv_alertas_negativas",
  "conv_informe_envios",
  "empresas",
  "kpi_semana_actual",
  "nexo_bot_resumenes_envios",
  "nexo_metric_validation_events",
  "perfiles",
  "resena_motivos",
  "resenas_historial",
  "restaurante_fuente_aliases",
  "restaurante_integraciones",
  "review_identity_shadow_events",
  "usuario_marcas",
  "usuario_restaurantes",
];
const WRITE = "insert, update, delete, truncate, references, trigger, maintain";

/** Sentencias SQL (sin los bloques DO, que se revisan aparte). */
const statements = (sql: string) =>
  sql
    .replace(/do \$\$[\s\S]*?\$\$;/g, "")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("SEC-011 migración: tablas existentes", () => {
  it.each(TABLES)("retira solo los privilegios de escritura a anon y authenticated en public.%s", (table) => {
    expect(statements(MIGRATION)).toContain(`revoke ${WRITE} on table public.${table} from anon, authenticated`);
  });

  it("afecta exactamente a las 16 tablas (ninguna más, ninguna menos)", () => {
    const touched = statements(MIGRATION)
      .filter((s) => s.startsWith("revoke") && s.includes(" on table "))
      .map((s) => /on table public\.(\w+) /.exec(s)![1]);
    expect(touched.sort()).toEqual([...TABLES].sort());
  });

  it("no usa REVOKE ALL ni retira SELECT (ni el de authenticated sobre perfiles)", () => {
    expect(MIGRATION).not.toMatch(/revoke\s+all/i);
    for (const s of statements(MIGRATION).filter((s) => s.startsWith("revoke"))) {
      expect(s.split(" on ")[0]).not.toMatch(/\bselect\b/);
    }
  });

  it("no toca service_role, postgres como destino de REVOKE, RLS, políticas, datos, funciones ni secuencias", () => {
    for (const s of statements(MIGRATION).filter((s) => s.startsWith("revoke"))) {
      expect(s.split(" from ")[1]).toBe("anon, authenticated");
    }
    expect(MIGRATION).not.toMatch(/service_role/i);
    expect(MIGRATION).not.toMatch(/row level security|enable|disable|force/i);
    expect(MIGRATION).not.toMatch(/\bpolicy\b|perfiles_select_own/i);
    expect(MIGRATION).not.toMatch(/\b(create|drop|alter\s+table|alter\s+function|alter\s+policy)\b/i);
    expect(MIGRATION).not.toMatch(/\b(insert\s+into|update\s+public|delete\s+from|truncate\s+table|copy)\b/i);
    expect(MIGRATION).not.toMatch(/\bfunctions?\b|\bsequences?\b|storage|graphql|realtime|\bgrant\b/i);
  });

  it("es transaccional", () => {
    expect(MIGRATION.trim().startsWith("begin;")).toBe(true);
    expect(MIGRATION.trim().endsWith("commit;")).toBe(true);
  });
});

describe("SEC-011 migración: default privileges", () => {
  it("cambia solo los de TABLAS en public de postgres y supabase_admin, retirando solo escritura a anon/authenticated", () => {
    expect(MIGRATION).toContain(`alter default privileges for role postgres in schema public\n  revoke ${WRITE} on tables from anon, authenticated;`);
    expect(MIGRATION).toContain(`alter default privileges for role supabase_admin in schema public\n      revoke ${WRITE} on tables from anon, authenticated;`);
    const all = MIGRATION.match(/alter default privileges[^;]*;/gi) ?? [];
    expect(all).toHaveLength(2);
    for (const statement of all) {
      expect(statement).toMatch(/in schema public/);
      expect(statement).toMatch(/\bon tables\b/);
      expect(statement).not.toMatch(/sequences|functions|types|schemas|\bselect\b|service_role/i);
    }
  });

  it("el cambio de supabase_admin solo se intenta si el rol actual puede hacerlo (postgres no es miembro)", () => {
    expect(MIGRATION).toContain("pg_has_role(current_user, 'supabase_admin', 'member')");
  });
});

describe("SEC-011 rollback", () => {
  it("avisa de que reabre SEC-011", () => {
    expect(ROLLBACK_RAW).toContain("ESTO REABRE SEC-011");
  });

  it.each(TABLES)("restaura exactamente los privilegios retirados en public.%s", (table) => {
    expect(statements(ROLLBACK)).toContain(`grant ${WRITE} on table public.${table} to anon, authenticated`);
  });

  it("restaura los default privileges de tablas de postgres y supabase_admin", () => {
    expect(ROLLBACK).toContain(`alter default privileges for role postgres in schema public\n  grant ${WRITE} on tables to anon, authenticated;`);
    expect(ROLLBACK).toContain(`alter default privileges for role supabase_admin in schema public\n      grant ${WRITE} on tables to anon, authenticated;`);
  });

  it("no usa GRANT ALL ni concede SELECT/service_role, ni toca RLS o datos", () => {
    expect(ROLLBACK).not.toMatch(/grant\s+all/i);
    for (const s of statements(ROLLBACK).filter((s) => s.startsWith("grant"))) expect(s.split(" on ")[0]).not.toMatch(/\bselect\b/);
    expect(ROLLBACK).not.toMatch(/service_role|row level security|\bpolicy\b|\brevoke\b/i);
  });
});

describe("SEC-011 verify.sql", () => {
  it("termina en rollback y comprueba las 16 tablas, perfiles, service_role, RLS y default privileges", () => {
    expect(VERIFY.trim().endsWith("rollback;")).toBe(true);
    for (const table of TABLES) expect(VERIFY).toContain(`'${table}'`);
    for (const privilege of ["'insert'", "'update'", "'delete'", "'truncate'", "'references'", "'trigger'", "'maintain'"]) {
      expect(VERIFY).toContain(privilege);
    }
    expect(VERIFY).toContain("perfiles_select_own");
    expect(VERIFY).toContain("has_table_privilege('authenticated', 'public.perfiles', 'SELECT')");
    expect(VERIFY).toContain("service_role");
    expect(VERIFY).toContain("relrowsecurity");
    expect(VERIFY).toContain("pg_default_acl");
  });

  it("prueba una tabla nueva dentro de la transacción (se descarta con el rollback)", () => {
    expect(VERIFY).toContain("create table public.__sec011_probe");
    expect(VERIFY.indexOf("create table public.__sec011_probe")).toBeLessThan(VERIFY.lastIndexOf("rollback;"));
    expect(VERIFY).not.toMatch(/\bcommit\b/i);
  });
});

describe("SEC-011 el navegador no escribe directamente en tablas de negocio", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      if (entry === "node_modules" || entry === ".next") return [];
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
    });
  }
  const files = ["app", "lib", "templates"].flatMap((dir) => sourceFiles(join(ROOT, dir)));
  const rel = (file: string) => relative(ROOT, file).split(sep).join("/");

  it("solo login y logout usan el cliente de navegador, y solo para Auth y para leer perfiles", () => {
    const users = files.filter((f) => /from "@\/lib\/supabase(\/client)?"/.test(readFileSync(f, "utf8"))).map(rel);
    const allowed = new Set([
      "app/login/login-form.tsx",
      "app/dashboard/_components/use-logout.ts",
      "app/test-supabase/page.tsx", // solo desarrollo
      "lib/supabase.ts",
      "lib/supabase/admin.ts",
    ]);
    expect(users.filter((f) => !allowed.has(f))).toEqual([]);

    for (const file of ["app/login/login-form.tsx", "app/dashboard/_components/use-logout.ts"]) {
      expect(read(file), file).not.toMatch(/\.(insert|update|upsert|delete)\(|\.rpc\(/);
    }
  });

  it("el único acceso a tablas del navegador es la lectura de su propio perfil", () => {
    const check = read("lib/auth/verify-perfil-client.ts");
    expect(check).toMatch(/\.from\(SUPABASE_TABLES\.perfiles\)\s*\.select\(/);
    expect(check).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });
});
