import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { sampleAlert, sampleMonthlyReport } from "@/lib/render/fixtures.test-helper";

const requireApiAuth = vi.fn();
const loadMonthlyReport = vi.fn();
const renderViaInternal = vi.fn();
const buildAlertDataForResena = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/reports/monthly/data", () => ({ loadMonthlyReport }));
vi.mock("@/lib/render/internal-render-client", () => ({ renderViaInternal }));
vi.mock("@/lib/notifications/build-alert-for-resena", () => ({ buildAlertDataForResena }));

const pdfRoute = await import("@/app/api/informes/mensual/[id]/route");
const imageRoute = await import("@/app/api/informes/mensual/[id]/imagen/route");
const negativeRoute = await import("@/app/api/generate-negative-review-image/route");
const networkRoute = await import("@/app/api/generate-network-summary-image/route");
const alertRoute = await import("@/app/api/notifications/whatsapp-alert-image/route");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]);
const PDF = Buffer.from("%PDF-1.7");
const scope = { restaurantIds: [7] };
const ctx = (id = "7") => ({ params: Promise.resolve({ id }) });
const get = (path: string) => new Request(`https://nexo.example${path}`);

beforeEach(() => {
  vi.resetAllMocks();
  requireApiAuth.mockResolvedValue({ ok: true, session: { scope, perfil: { rol: "super_admin" } } });
  loadMonthlyReport.mockResolvedValue(sampleMonthlyReport());
  renderViaInternal.mockResolvedValue(PNG);
});

describe("GET /api/informes/mensual/[id] (PDF)", () => {
  it("mismos cabeceras y nombre de archivo; el render lo hace el renderer", async () => {
    renderViaInternal.mockResolvedValue(PDF);
    const res = await pdfRoute.GET(get("/api/informes/mensual/7?offset=1"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="Nexo_Origen_burger-king-zizur_2026-09.pdf"');
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PDF);
    expect(loadMonthlyReport).toHaveBeenCalledWith(7, 1, scope);
    expect(renderViaInternal).toHaveBeenCalledWith({ op: "monthly_pdf", report: sampleMonthlyReport() });
  });

  it("sin sesión, parámetros inválidos y restaurante fuera de alcance: igual que antes", async () => {
    requireApiAuth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await pdfRoute.GET(get("/api/informes/mensual/7"), ctx())).status).toBe(401);
    expect((await pdfRoute.GET(get("/api/informes/mensual/x"), ctx("x"))).status).toBe(400);
    expect((await pdfRoute.GET(get("/api/informes/mensual/7?offset=99"), ctx())).status).toBe(400);
    loadMonthlyReport.mockResolvedValueOnce(null);
    expect((await pdfRoute.GET(get("/api/informes/mensual/7"), ctx())).status).toBe(404);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("si el renderer falla: 500 con el mismo mensaje genérico", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderViaInternal.mockRejectedValue(new Error("boom"));
    const res = await pdfRoute.GET(get("/api/informes/mensual/7"), ctx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "No se pudo generar el informe mensual" });
    spy.mockRestore();
  });
});

describe("GET /api/informes/mensual/[id]/imagen", () => {
  it("PNG con su nombre de archivo", async () => {
    const res = await imageRoute.GET(get("/api/informes/mensual/7/imagen"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="Nexo_Origen_burger-king-zizur_2026-09.png"');
    expect(renderViaInternal).toHaveBeenCalledWith({ op: "monthly_image", report: sampleMonthlyReport() });
  });
});

describe("POST /api/generate-negative-review-image", () => {
  const post = (body: unknown) =>
    negativeRoute.POST(new Request("https://nexo.example/api/generate-negative-review-image", { method: "POST", body: JSON.stringify(body) }));

  it("PNG inline con nombre nexo-alerta-…; los datos normalizados van al renderer", async () => {
    const res = await post(sampleAlert({ restaurant_name: "BK Utebo", review_date: "12 Mar 2026" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="nexo-alerta-bk-utebo-12-mar-2026.png"');
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(renderViaInternal.mock.calls[0]![0]).toMatchObject({ op: "negative_review_image", data: { restaurant_name: "BK Utebo" } });
  });

  it("si el renderer falla devuelve su mensaje en 500 (como antes)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderViaInternal.mockRejectedValue(new Error("Chromium no arrancó"));
    const res = await post({});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Chromium no arrancó" });
  });
});

describe("GET /api/generate-network-summary-image", () => {
  it("PNG con nombre nexo-informe-<periodo>-<grupo>; delega con periodo, grupo y offset", async () => {
    const res = await networkRoute.GET(get("/api/generate-network-summary-image?periodo=semanal&grupo=bk&offset=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline; filename="nexo-informe-semanal-[a-z0-9-]+\.png"$/);
    expect(renderViaInternal).toHaveBeenCalledWith({ op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 1 });
  });

  it("parámetros inválidos → 400 sin llamar al renderer; sin sesión → 401", async () => {
    expect((await networkRoute.GET(get("/api/generate-network-summary-image?periodo=diario&grupo=bk"))).status).toBe(400);
    expect((await networkRoute.GET(get("/api/generate-network-summary-image?periodo=semanal&grupo=nope"))).status).toBe(400);
    requireApiAuth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await networkRoute.GET(get("/api/generate-network-summary-image?periodo=semanal&grupo=bk"))).status).toBe(401);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });
});

describe("GET /api/notifications/whatsapp-alert-image", () => {
  const path = (token: string, id = "55") => `/api/notifications/whatsapp-alert-image?resena_id=${id}&token=${token}`;

  it("token incorrecto → 401 y no se consulta nada", async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "secreto-whatsapp";
    expect((await alertRoute.GET(get(path("otro")))).status).toBe(401);
    expect(buildAlertDataForResena).not.toHaveBeenCalled();
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("con token válido devuelve el PNG de la alerta", async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "secreto-whatsapp";
    buildAlertDataForResena.mockResolvedValue(sampleAlert());
    const res = await alertRoute.GET(get(path("secreto-whatsapp")));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(buildAlertDataForResena).toHaveBeenCalledWith(55);
    expect(renderViaInternal.mock.calls[0]![0]).toMatchObject({ op: "whatsapp_alert_image" });
  });

  it("reseña inexistente → 404; fallo de render → 500 genérico", async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "secreto-whatsapp";
    buildAlertDataForResena.mockResolvedValueOnce(null);
    expect((await alertRoute.GET(get(path("secreto-whatsapp")))).status).toBe(404);

    vi.spyOn(console, "error").mockImplementation(() => {});
    buildAlertDataForResena.mockResolvedValue(sampleAlert());
    renderViaInternal.mockRejectedValue(new Error("boom"));
    const res = await alertRoute.GET(get(path("secreto-whatsapp")));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("No se pudo generar la imagen");
  });
});
