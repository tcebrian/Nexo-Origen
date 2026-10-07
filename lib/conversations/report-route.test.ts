import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
} from "@/lib/conversations/outbound-fake.test-helper";

const TOKEN = "EAAB-super-secret-token";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4]);
const SCOPE = { rol: "super_admin" };

const requireApiAuth = vi.fn();
const uploadMedia = vi.fn();
const sendDocumentMessage = vi.fn();
const resolveMonthlyTarget = vi.fn();
const loadMonthlyReport = vi.fn();
const generateMonthlyPdf = vi.fn();
const listReportableRestaurants = vi.fn();
let fake = createFakeOutboundRepo();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/conversations/outbound.server", () => ({
  get outboundRepository() {
    return fake.repo;
  },
}));
vi.mock("@/lib/whatsapp/cloud-api.server", () => ({
  sendTextMessage: vi.fn(),
  uploadMedia,
  sendDocumentMessage,
  isWhatsAppSenderConfigured: () => true,
}));
vi.mock("@/lib/reports/monthly/data", () => ({
  resolveMonthlyTarget,
  loadMonthlyReport,
  listReportableRestaurants,
  monthlyPeriod: (offset: number) => ({
    startKey: new Date(Date.UTC(2026, 8 - offset, 1)).toISOString().slice(0, 10),
  }),
}));
vi.mock("@/lib/reports/monthly/pdf", () => ({ generateMonthlyPdf }));

const { POST } = await import("@/app/api/conversations/[conversationId]/reports/route");
const { GET: optionsRoute } = await import("@/app/api/conversations/report-options/route");

const ctx = (id: string) => ({ params: Promise.resolve({ conversationId: id }) });
const validBody = { requestId: REQUEST_ID, reportType: "monthly", restaurantId: 123, offset: 0 };

function post(body: unknown, id = CONVERSATION_ID) {
  return POST(
    new Request(`http://localhost/api/conversations/${id}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(id)
  );
}
const asRole = (rol: string) =>
  requireApiAuth.mockResolvedValue({ ok: true, session: { perfil: { rol }, scope: { ...SCOPE, rol } } });

beforeEach(() => {
  vi.resetAllMocks();
  fake = createFakeOutboundRepo();
  asRole("super_admin");
  resolveMonthlyTarget.mockResolvedValue({
    restaurantId: 123,
    name: "BK Zizur",
    brand: "Burger King",
    city: "Zizur",
    startKey: "2026-09-01",
    endKey: "2026-09-30",
    label: "01 al 30 de septiembre de 2026",
  });
  loadMonthlyReport.mockResolvedValue({ restaurant: { name: "BK Zizur" } });
  generateMonthlyPdf.mockResolvedValue(Buffer.from(PDF));
  uploadMedia.mockResolvedValue({ status: "uploaded", mediaId: "MEDIA-9" });
  sendDocumentMessage.mockResolvedValue({ status: "sent", wamid: "wamid.REPORT" });
  listReportableRestaurants.mockResolvedValue([{ id: 123, name: "BK Zizur", brand: "Burger King", city: "Zizur" }]);
});

describe("POST /api/conversations/[id]/reports", () => {
  it("sin sesión → 401", async () => {
    requireApiAuth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    });
    expect((await post(validBody)).status).toBe(401);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s → 403 sin generar ni enviar", async (rol) => {
    asRole(rol);
    expect((await post(validBody)).status).toBe(403);
    expect(resolveMonthlyTarget).not.toHaveBeenCalled();
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(fake.rows).toHaveLength(0);
  });

  it("conversationId, requestId, tipo, restaurante y periodo inválidos → 400", async () => {
    expect((await post(validBody, "nope")).status).toBe(400);
    expect((await post({ ...validBody, requestId: "x" })).status).toBe(400);
    expect((await post({ ...validBody, reportType: "semanal" })).status).toBe(400);
    expect((await post({ ...validBody, restaurantId: -4 })).status).toBe(400);
    expect((await post({ ...validBody, offset: 99 })).status).toBe(400);
    expect((await post("{no json")).status).toBe(400);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
  });

  it("restaurante inexistente o fuera de scope → 404 sin generar", async () => {
    resolveMonthlyTarget.mockResolvedValue(null);
    const res = await post(validBody);
    expect(res.status).toBe(404);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
    expect(fake.rows).toHaveLength(0);
  });

  it("conversación inexistente → 404", async () => {
    fake = createFakeOutboundRepo({ context: null });
    expect((await post(validBody)).status).toBe(404);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
  });

  it("éxito: datos cargados en servidor con el scope de la sesión, PDF generado en servidor y enviado a Meta", async () => {
    const res = await post({
      ...validBody,
      to: "+34999999999",
      media_id: "x",
      bytes: "AAAA",
      scope: { rol: "hacker" },
    });
    expect(res.status).toBe(200);

    // El scope sale de la sesión, no del cuerpo.
    expect(resolveMonthlyTarget).toHaveBeenCalledWith(123, 0, expect.objectContaining({ rol: "super_admin" }));
    expect(loadMonthlyReport).toHaveBeenCalledWith(123, 0, expect.objectContaining({ rol: "super_admin" }));
    expect(generateMonthlyPdf).toHaveBeenCalledTimes(1);

    expect(uploadMedia.mock.calls[0]![0]).toMatchObject({ mimeType: "application/pdf", phoneNumberId: "1365004563368241" });
    expect(sendDocumentMessage.mock.calls[0]![0]).toMatchObject({ mediaId: "MEDIA-9", to: "+34600111222" });

    expect(fake.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "document",
      status: "sent",
      external_id: "wamid.REPORT",
    });
    expect(fake.rows[0]!.media).toMatchObject({ source: "nexo_report", report_type: "monthly", restaurant_id: 123 });
    expect(fake.touches[0]!.preview).toBe("📊 Informe mensual · BK Zizur");
  });

  it("la respuesta no contiene token, bytes, raw_payload ni ids de Meta", async () => {
    const json = await (await post(validBody)).json();
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0]).toMatchObject({ contentType: "document", label: "📊 Informe de Nexo", status: "sent" });
    const raw = JSON.stringify(json);
    for (const forbidden of [TOKEN, "raw_payload", "MEDIA-9", "wamid.REPORT", "external_id", "client_request_id", "+34600111222", "JVBER"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("doble requestId: un único informe, sin volver a generar", async () => {
    await post(validBody);
    expect((await post(validBody)).status).toBe(200);
    expect(generateMonthlyPdf).toHaveBeenCalledTimes(1);
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    expect(sendDocumentMessage).toHaveBeenCalledTimes(1);
    expect(fake.rows).toHaveLength(1);
  });

  it("fallo incierto → 502 y el reintento (409) no genera ni reenvía", async () => {
    sendDocumentMessage.mockResolvedValue({ status: "unconfirmed" });
    expect((await post(validBody)).status).toBe(502);
    expect((await post(validBody)).status).toBe(409);
    expect(generateMonthlyPdf).toHaveBeenCalledTimes(1);
    expect(sendDocumentMessage).toHaveBeenCalledTimes(1);
  });

  it("fallo al generar → 500 seguro sin enviar nada", async () => {
    generateMonthlyPdf.mockRejectedValue(new Error("Las reseñas no coinciden"));
    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("generation_failed");
    expect(uploadMedia).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversations/report-options", () => {
  const get = () => optionsRoute(new Request("http://localhost/api/conversations/report-options"));

  it("no super_admin → 403", async () => {
    asRole("empresa_admin");
    expect((await get()).status).toBe(403);
    expect(listReportableRestaurants).not.toHaveBeenCalled();
  });

  it("super_admin recibe tipos, restaurantes (con scope) y periodos", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reportTypes).toEqual([{ id: "monthly", label: "Informe mensual por restaurante" }]);
    expect(json.restaurants).toEqual([{ id: 123, name: "BK Zizur", brand: "Burger King", city: "Zizur" }]);
    expect(json.periods[0]).toEqual({ offset: 0, label: "Septiembre 2026" });
    expect(listReportableRestaurants).toHaveBeenCalledWith(expect.objectContaining({ rol: "super_admin" }));
  });
});
