import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTemplateRequest } from "@/lib/conversations/whatsapp-templates";
import { slotForDate } from "./calendar";

const processDailyReport = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/reports/daily/process.server", () => ({ processDailyReport }));

const route = await import("@/app/api/cron/informe-diario/route");

const SECRET = "cron-secret-0123456789abcdef";
const call = (headers: Record<string, string> = {}, method: "GET" | "POST" = "POST") =>
  (method === "GET" ? route.GET : route.POST)(new Request("https://nexo.example/api/cron/informe-diario", { method, headers }));

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = SECRET;
  processDailyReport.mockResolvedValue({ status: "ran", sent: 2 });
});

describe("POST /api/cron/informe-diario", () => {
  it("sin credencial o con una incorrecta → 401 y no se envía nada", async () => {
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: "Bearer otro" })).status).toBe(401);
    expect((await call({ "user-agent": "vercel-cron/1.0" })).status).toBe(401);
    expect(processDailyReport).not.toHaveBeenCalled();
  });

  it("sin CRON_SECRET (o demasiado corto) el job queda cerrado, sin respaldo por user-agent", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: `Bearer ${SECRET}`, "user-agent": "vercel-cron" })).status).toBe(401);
    process.env.CRON_SECRET = "corto";
    expect((await call({ authorization: "Bearer corto" })).status).toBe(401);
    expect(processDailyReport).not.toHaveBeenCalled();
  });

  it("con la credencial correcta ejecuta el slot y devuelve el resumen (POST de pg_net o GET)", async () => {
    for (const method of ["POST", "GET"] as const) {
      const res = await call({ authorization: `Bearer ${SECRET}` }, method);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, status: "ran", sent: 2 });
    }
    expect(processDailyReport).toHaveBeenCalledTimes(2);
  });

  it("un fallo interno es 500 genérico sin detalles", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    processDailyReport.mockRejectedValue(new Error("secreto: +34600111222"));
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("34600111222");
  });
});

describe("plantilla informe_diario", () => {
  it("{{1}} nombre y {{2}} descripción del periodo, en español, sin componente de botón", () => {
    const closure = buildTemplateRequest("informe_diario", ["Ana", slotForDate("2026-10-19").templateLabel]);
    expect(closure).toEqual({
      name: "informe_diario",
      language: "es",
      bodyParams: ["Ana", "cierre de la semana del 12 al 18 de octubre"],
      buttonPayloads: [],
    });
    const wtd = buildTemplateRequest("informe_diario", ["Ana", slotForDate("2026-10-14").templateLabel]);
    expect(wtd.bodyParams[1]).toBe("semana en curso hasta el 14 de octubre");
    expect(wtd.buttonPayloads).toEqual([]);
  });
});

describe("migración y cableado", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

  it("la migración crea la restricción única (contacto, día, plantilla) y el snapshot JSONB", () => {
    const sql = read("supabase/conv_informe_envios.sql");
    expect(sql).toContain("unique (contacto_id, slot_date, template)");
    expect(sql).toMatch(/snapshot\s+jsonb/);
    expect(sql).toContain("template_wamid");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("nexo_reputation_window_metrics");
    // La función por días no se toca.
    expect(sql).not.toMatch(/replace function public\.nexo_reputation_period_metrics/);
  });

  it("el job reserva ANTES de enviar y calcula el snapshot con el slot, no con Date.now()", () => {
    const job = read("lib/reports/daily/job.ts");
    expect(job.indexOf("deps.reserve(")).toBeLessThan(job.indexOf("deps.send("));
    expect(job.indexOf("deps.saveSnapshot(")).toBeLessThan(job.indexOf("deps.send("));
    expect(read("lib/reports/daily/snapshot.ts")).not.toMatch(/Date\.now|new Date\(\)/);
  });

  it("el renderer no consulta la base de datos: solo lee el snapshot", () => {
    const renderer = read("lib/reports/daily/render-text.ts");
    expect(renderer).not.toMatch(/supabase|fetch\(|rpc\(/i);
  });
});
