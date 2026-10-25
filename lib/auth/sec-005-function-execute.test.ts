import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SEC-005 — `anon`/`authenticated`/`PUBLIC` no ejecutan las funciones SECURITY DEFINER del cron ni del trigger de
 * alertas. Pruebas estáticas del SQL (no hay base de datos en CI); la prueba real es `supabase/sec_005_verify.sql`.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const sqlOf = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

const MIGRATION = sqlOf(read("supabase/sec_005_revoke_cron_alert_function_execute.sql"));
const ROLLBACK = sqlOf(read("supabase/sec_005_revoke_cron_alert_function_execute_rollback.sql"));
const VERIFY = sqlOf(read("supabase/sec_005_verify.sql"));

const FUNCTIONS = ["public.nexo_call_daily_report_cron()", "public.nexo_notify_negative_review_alert()"];

describe("SEC-005 migración", () => {
  it.each(FUNCTIONS)("revoca EXECUTE de %s a public, anon, authenticated y service_role", (fn) => {
    expect(MIGRATION).toContain(`revoke execute on function ${fn} from public, anon, authenticated, service_role;`);
  });

  it("solo contiene los dos REVOKE, en una transacción", () => {
    const statements = MIGRATION.split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toEqual([
      "begin",
      `revoke execute on function ${FUNCTIONS[0]} from public, anon, authenticated, service_role`,
      `revoke execute on function ${FUNCTIONS[1]} from public, anon, authenticated, service_role`,
      "commit",
    ]);
  });

  it("no revoca al propietario postgres", () => {
    expect(MIGRATION).not.toMatch(/postgres/i);
  });

  it("no cambia cuerpo, SECURITY DEFINER, search_path, Vault, pg_cron, trigger ni secretos", () => {
    expect(MIGRATION).not.toMatch(/create\s+(or\s+replace\s+)?(function|trigger)|alter\s+function|drop\s+trigger/i);
    expect(MIGRATION).not.toMatch(/security\s+(definer|invoker)|search_path/i);
    expect(MIGRATION).not.toMatch(/vault|cron\.|net\.http|secret/i);
    expect(MIGRATION).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});

describe("SEC-005 rollback", () => {
  it.each(FUNCTIONS)("restaura solo el EXECUTE anterior de %s", (fn) => {
    expect(ROLLBACK).toContain(`grant execute on function ${fn} to public, anon, authenticated, service_role;`);
  });

  it("no toca nada más", () => {
    expect(ROLLBACK).not.toMatch(/create|alter|drop|revoke|vault|cron\./i);
  });
});

describe("SEC-005 script de verificación", () => {
  it("termina en rollback y solo prueba la ejecución como anon (denegada)", () => {
    expect(VERIFY.trim().endsWith("rollback;")).toBe(true);
    expect(VERIFY).toContain("set local role anon");
  });

  it("comprueba anon, authenticated, PUBLIC, postgres, cron, trigger y secretos", () => {
    expect(VERIFY).toContain("has_function_privilege('anon'");
    expect(VERIFY).toContain("has_function_privilege('authenticated'");
    expect(VERIFY).toContain("a.grantee = 0"); // PUBLIC
    expect(VERIFY).toContain("has_function_privilege('postgres'");
    expect(VERIFY).toContain("nexo_informe_diario_09_madrid");
    expect(VERIFY).toContain("job.username <> 'postgres'");
    expect(VERIFY).toContain("nexo_negative_review_alert_webhook");
    expect(VERIFY).toContain("t.tgenabled = 'O'");
    expect(VERIFY).toContain("vault.secrets");
    expect(VERIFY).not.toMatch(/decrypted_secret/);
  });
});
