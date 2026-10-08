import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RENDER_MAX_BODY_BYTES,
  RENDER_SIGNATURE_HEADER,
  RENDER_TIMESTAMP_HEADER,
  signRenderBody,
} from "@/lib/render/protocol";
import { SECRET, sampleAlert, sampleMonthlyReport } from "@/lib/render/fixtures.test-helper";

const executeRender = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/render/renderer.server", () => ({ executeRender }));

const route = await import("@/app/api/internal/render/route");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const PDF = Buffer.from("%PDF-1.7 fake");

function signed(payload: unknown, over: { secret?: string; timestamp?: number; signature?: string; raw?: string } = {}) {
  const raw = over.raw ?? JSON.stringify(payload);
  const body = new TextEncoder().encode(raw);
  const timestamp = over.timestamp ?? Date.now();
  return new Request("https://nexo.example/api/internal/render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [RENDER_TIMESTAMP_HEADER]: String(timestamp),
      [RENDER_SIGNATURE_HEADER]: over.signature ?? signRenderBody(body, over.secret ?? SECRET, timestamp),
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXO_INTERNAL_RENDER_TOKEN = SECRET;
  executeRender.mockResolvedValue({ contentType: "image/png", body: PNG });
});

describe("POST /api/internal/render — autenticación", () => {
  const request = { op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0 };

  it("firma correcta → renderiza", async () => {
    const res = await route.POST(signed(request));
    expect(res.status).toBe(200);
    expect(executeRender).toHaveBeenCalledTimes(1);
  });

  it("token incorrecto (firma con otra clave) → 401 y no renderiza", async () => {
    const res = await route.POST(signed(request, { secret: "otro-secreto-completamente-distinto" }));
    expect(res.status).toBe(401);
    expect(executeRender).not.toHaveBeenCalled();
  });

  it("HMAC incorrecto o ausente → 401", async () => {
    expect((await route.POST(signed(request, { signature: "0".repeat(64) }))).status).toBe(401);
    expect((await route.POST(signed(request, { signature: "basura" }))).status).toBe(401);
    const noHeaders = new Request("https://nexo.example/api/internal/render", { method: "POST", body: JSON.stringify(request) });
    expect((await route.POST(noHeaders)).status).toBe(401);
    expect(executeRender).not.toHaveBeenCalled();
  });

  it("cuerpo alterado después de firmar → 401", async () => {
    const original = signed(request);
    const tampered = new Request(original.url, {
      method: "POST",
      headers: original.headers,
      body: JSON.stringify({ ...request, grupo: "pp" }),
    });
    expect((await route.POST(tampered)).status).toBe(401);
  });

  it("timestamp caducado → 401", async () => {
    expect((await route.POST(signed(request, { timestamp: Date.now() - 61_000 }))).status).toBe(401);
    expect((await route.POST(signed(request, { timestamp: Date.now() + 61_000 }))).status).toBe(401);
    expect(executeRender).not.toHaveBeenCalled();
  });

  it("todos los fallos de autenticación responden igual (no se revela cuál)", async () => {
    const a = await (await route.POST(signed(request, { signature: "0".repeat(64) }))).text();
    const b = await (await route.POST(signed(request, { timestamp: Date.now() - 120_000 }))).text();
    expect(a).toBe(b);
  });

  it("sin credencial configurada el renderer queda cerrado (503)", async () => {
    delete process.env.NEXO_INTERNAL_RENDER_TOKEN;
    expect((await route.POST(signed(request))).status).toBe(503);
    process.env.NEXO_INTERNAL_RENDER_TOKEN = "corto";
    expect((await route.POST(signed(request))).status).toBe(503);
    expect(executeRender).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/render — validación y límites", () => {
  it("operación desconocida → 400", async () => {
    const res = await route.POST(signed({ op: "screenshot", url: "https://evil.example" }));
    expect(res.status).toBe(400);
    expect(executeRender).not.toHaveBeenCalled();
  });

  it("payload inválido → 400", async () => {
    expect((await route.POST(signed({ op: "monthly_pdf", report: { restaurant: 1 } }))).status).toBe(400);
    expect((await route.POST(signed({ op: "negative_review_image", data: "x" }))).status).toBe(400);
    expect((await route.POST(signed({ op: "network_summary_image", periodo: "semanal", grupo: "no-existe", offset: 0 }))).status).toBe(400);
    expect((await route.POST(signed(null, { raw: "{no es json" }))).status).toBe(400);
    expect(executeRender).not.toHaveBeenCalled();
  });

  it("intento de URL arbitraria / SSRF en la alerta → 400, no se renderiza", async () => {
    const res = await route.POST(
      signed({ op: "negative_review_image", data: sampleAlert({ brand_logo_url: "http://169.254.169.254/latest/meta-data/" }) })
    );
    expect(res.status).toBe(400);
    expect(executeRender).not.toHaveBeenCalled();
  });

  it("un campo url/host/origin en una operación válida se descarta antes de renderizar", async () => {
    await route.POST(
      signed({ op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0, url: "https://evil.example", origin: "https://evil.example" })
    );
    expect(executeRender).toHaveBeenCalledWith({ op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0 });
  });

  it("cuerpo demasiado grande → 413", async () => {
    const raw = JSON.stringify({ op: "monthly_pdf", pad: "x".repeat(RENDER_MAX_BODY_BYTES + 10) });
    expect((await route.POST(signed(null, { raw }))).status).toBe(413);
    expect(executeRender).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/render — operaciones", () => {
  it("monthly_pdf → application/pdf", async () => {
    executeRender.mockResolvedValue({ contentType: "application/pdf", body: PDF });
    const res = await route.POST(signed({ op: "monthly_pdf", report: sampleMonthlyReport() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PDF);
    expect(executeRender.mock.calls[0]![0]).toMatchObject({ op: "monthly_pdf" });
  });

  it.each([
    ["monthly_image", { report: sampleMonthlyReport() }],
    ["negative_review_image", { data: sampleAlert() }],
    ["whatsapp_alert_image", { data: sampleAlert() }],
    ["network_summary_image", { periodo: "trimestral", grupo: "sg-es", offset: 2 }],
  ])("%s → image/png con los bytes del generador", async (op, rest) => {
    const res = await route.POST(signed({ op, ...rest }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
    expect(executeRender.mock.calls[0]![0]).toMatchObject({ op });
  });

  it("si el generador falla → 500 con el mensaje, sin datos de la petición", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    executeRender.mockRejectedValue(new Error("Chromium no arrancó"));
    const res = await route.POST(signed({ op: "monthly_pdf", report: sampleMonthlyReport() }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Chromium no arrancó" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Burger King Zizur");
    spy.mockRestore();
  });
});
