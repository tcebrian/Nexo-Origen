import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
} from "@/lib/conversations/outbound-fake.test-helper";

const TOKEN = "EAAB-super-secret-token";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const SCOPE = { rol: "super_admin" };

const requireApiAuth = vi.fn();
const uploadMedia = vi.fn();
const sendDocumentMessage = vi.fn();
const sendImageMessage = vi.fn();
const resolveMonthlyTarget = vi.fn();
const loadMonthlyReport = vi.fn();
const generateMonthlyPdf = vi.fn();
const generateMonthlyPng = vi.fn();
const listReportableRestaurants = vi.fn();
const captureNetworkSummaryPng = vi.fn();
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
  sendImageMessage,
  isWhatsAppSenderConfigured: () => true,
}));
vi.mock("@/lib/reports/monthly/data", () => ({
  resolveMonthlyTarget,
  loadMonthlyReport,
  listReportableRestaurants,
}));
vi.mock("@/lib/reports/monthly/pdf", () => ({ generateMonthlyPdf }));
vi.mock("@/lib/reports/monthly/image/capture", () => ({ generateMonthlyPng }));
vi.mock("@/lib/reports/network-summary/capture-image", () => ({ captureNetworkSummaryPng }));

const { POST } = await import("@/app/api/conversations/[conversationId]/reports/route");
const { GET: optionsRoute } = await import("@/app/api/conversations/report-options/route");

const ctx = (id: string) => ({ params: Promise.resolve({ conversationId: id }) });
const validBody = { requestId: REQUEST_ID, reportType: "monthly", format: "pdf", restaurantId: 123, period: 0 };

function post(body: unknown, id = CONVERSATION_ID) {
  return POST(
    new Request(`https://nexo.example/api/conversations/${id}/reports`, {
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
  generateMonthlyPng.mockResolvedValue(Buffer.from(PNG));
  captureNetworkSummaryPng.mockResolvedValue(Buffer.from(PNG));
  uploadMedia.mockResolvedValue({ status: "uploaded", mediaId: "MEDIA-9" });
  sendDocumentMessage.mockResolvedValue({ status: "sent", wamid: "wamid.REPORT" });
  sendImageMessage.mockResolvedValue({ status: "sent", wamid: "wamid.IMAGE" });
  listReportableRestaurants.mockResolvedValue([{ id: 123, name: "BK Zizur", brand: "Burger King", city: "Zizur" }]);
});

describe("POST /api/conversations/[id]/reports (validación y seguridad)", () => {
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
    for (const body of [
      validBody,
      { ...validBody, format: "image" },
      { requestId: REQUEST_ID, reportType: "weekly", format: "image", groupId: "bk", period: 0 },
    ]) {
      expect((await post(body)).status).toBe(403);
    }
    expect(resolveMonthlyTarget).not.toHaveBeenCalled();
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
    expect(generateMonthlyPng).not.toHaveBeenCalled();
    expect(captureNetworkSummaryPng).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(fake.rows).toHaveLength(0);
  });

  it("conversationId, requestId, tipo, formato, sujeto y periodo inválidos → 400", async () => {
    expect((await post(validBody, "nope")).status).toBe(400);
    expect((await post({ ...validBody, requestId: "x" })).status).toBe(400);
    expect((await post({ ...validBody, reportType: "daily" })).status).toBe(400);
    expect((await post({ ...validBody, reportType: "annual" })).status).toBe(400);
    expect((await post({ ...validBody, format: "gif" })).status).toBe(400);
    expect((await post({ ...validBody, restaurantId: -4 })).status).toBe(400);
    expect((await post({ ...validBody, period: 99 })).status).toBe(400);
    expect((await post("{no json")).status).toBe(400);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
  });

  it("formato no soportado por el tipo → 400 (la red semanal y trimestral no tienen PDF)", async () => {
    const weeklyPdf = await post({ requestId: REQUEST_ID, reportType: "weekly", format: "pdf", groupId: "bk", period: 0 });
    expect(weeklyPdf.status).toBe(400);
    expect((await weeklyPdf.json()).error).toBe("Formato no disponible para este informe");
    expect(
      (await post({ requestId: REQUEST_ID, reportType: "quarterly", format: "pdf", groupId: "bk", period: 0 })).status
    ).toBe(400);
    expect(captureNetworkSummaryPng).not.toHaveBeenCalled();
  });

  it("el periodo se valida según el tipo (trimestral máx. 11, semanal máx. 51, mensual máx. 35)", async () => {
    const quarterly = { requestId: REQUEST_ID, reportType: "quarterly", format: "image", groupId: "bk" };
    expect((await post({ ...quarterly, period: 12 })).status).toBe(400);
    expect((await post({ ...validBody, period: 36 })).status).toBe(400);
    expect(
      (await post({ requestId: REQUEST_ID, reportType: "weekly", format: "image", groupId: "bk", period: 52 })).status
    ).toBe(400);
  });

  it("restaurante inexistente → 404 sin generar; red desconocida → 400", async () => {
    resolveMonthlyTarget.mockResolvedValue(null);
    expect((await post(validBody)).status).toBe(404);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
    expect(
      (await post({ requestId: REQUEST_ID, reportType: "weekly", format: "image", groupId: "zz", period: 0 })).status
    ).toBe(400);
    expect(fake.rows).toHaveLength(0);
  });

  it("conversación inexistente → 404", async () => {
    fake = createFakeOutboundRepo({ context: null });
    expect((await post(validBody)).status).toBe(404);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
  });
});

describe("POST reports: mensual PDF (sin cambios)", () => {
  it("datos cargados en servidor con el scope de la sesión, PDF generado y enviado a Meta", async () => {
    const res = await post({ ...validBody, to: "+34999999999", media_id: "x", bytes: "AAAA", scope: { rol: "hacker" } });
    expect(res.status).toBe(200);

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

  it("sin formato ni periodo (cliente anterior con `offset`) sigue siendo un PDF del último mes", async () => {
    const res = await post({ requestId: REQUEST_ID, reportType: "monthly", restaurantId: 123, offset: 0 });
    expect(res.status).toBe(200);
    expect(sendDocumentMessage).toHaveBeenCalledTimes(1);
    expect(sendImageMessage).not.toHaveBeenCalled();
  });

  it("la respuesta no contiene token, bytes, raw_payload ni ids de Meta", async () => {
    const json = await (await post(validBody)).json();
    expect(json.messages[0]).toMatchObject({ contentType: "document", label: "📊 Informe de Nexo", status: "sent" });
    const raw = JSON.stringify(json);
    for (const forbidden of [TOKEN, "raw_payload", "MEDIA-9", "wamid.REPORT", "external_id", "client_request_id", "+34600111222", "JVBER"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("doble requestId, fallo incierto y fallo al generar", async () => {
    await post(validBody);
    expect((await post(validBody)).status).toBe(200);
    expect(generateMonthlyPdf).toHaveBeenCalledTimes(1);
    expect(sendDocumentMessage).toHaveBeenCalledTimes(1);
    expect(fake.rows).toHaveLength(1);

    fake = createFakeOutboundRepo();
    sendDocumentMessage.mockResolvedValue({ status: "unconfirmed" });
    expect((await post({ ...validBody, requestId: "11111111-1111-4111-8111-111111111111" })).status).toBe(502);
    expect((await post({ ...validBody, requestId: "11111111-1111-4111-8111-111111111111" })).status).toBe(409);

    generateMonthlyPdf.mockRejectedValue(new Error("Las reseñas no coinciden"));
    const res = await post({ ...validBody, requestId: "22222222-2222-4222-8222-222222222222" });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("generation_failed");
  });
});

describe("POST reports: mensual Imagen (sin cambios)", () => {
  const imageBody = { ...validBody, format: "image" };

  it("imagen generada en servidor con el scope de la sesión y enviada con el media_id", async () => {
    const res = await post({ ...imageBody, bytes: "AAAA", media_id: "x", to: "+34999999999" });
    expect(res.status).toBe(200);
    expect(generateMonthlyPng).toHaveBeenCalledTimes(1);
    expect(generateMonthlyPdf).not.toHaveBeenCalled();
    expect(uploadMedia.mock.calls[0]![0]).toMatchObject({ mimeType: "image/png" });
    expect(Array.from(uploadMedia.mock.calls[0]![0].bytes as Uint8Array)).toEqual(Array.from(PNG));
    expect(sendImageMessage.mock.calls[0]![0]).toMatchObject({ mediaId: "MEDIA-9", to: "+34600111222" });
    expect(sendDocumentMessage).not.toHaveBeenCalled();
    expect(fake.rows[0]).toMatchObject({ content_type: "image", external_id: "wamid.IMAGE", status: "sent" });
    expect(fake.rows[0]!.media).toMatchObject({ source: "nexo_report", report_format: "image", page_index: 0 });
  });

  it("doble requestId: una sola imagen; incierto: 502 y retry 409 sin reenviar", async () => {
    await post(imageBody);
    expect((await post(imageBody)).status).toBe(200);
    expect(generateMonthlyPng).toHaveBeenCalledTimes(1);
    expect(sendImageMessage).toHaveBeenCalledTimes(1);

    fake = createFakeOutboundRepo();
    sendImageMessage.mockResolvedValue({ status: "unconfirmed" });
    const other = { ...imageBody, requestId: "33333333-3333-4333-8333-333333333333" };
    expect((await post(other)).status).toBe(502);
    expect((await post(other)).status).toBe(409);
    expect(sendImageMessage).toHaveBeenCalledTimes(2);
  });
});

describe("POST reports: informes de red (semanal y trimestral)", () => {
  const weekly = { requestId: REQUEST_ID, reportType: "weekly", format: "image", groupId: "bk", period: 1 };
  const quarterly = { requestId: REQUEST_ID, reportType: "quarterly", format: "image", groupId: "sg-es", period: 0 };

  it("semanal: la imagen se genera en servidor, sin bytes del navegador, y se envía como image", async () => {
    const res = await post({ ...weekly, bytes: "AAAA", media_id: "x", to: "+34999999999" });
    expect(res.status).toBe(200);

    expect(captureNetworkSummaryPng).toHaveBeenCalledWith("semanal", "bk", "https://nexo.example", 1);
    expect(generateMonthlyPng).not.toHaveBeenCalled();
    expect(uploadMedia.mock.calls[0]![0]).toMatchObject({ mimeType: "image/png", phoneNumberId: "1365004563368241" });
    expect(sendImageMessage.mock.calls[0]![0]).toMatchObject({ mediaId: "MEDIA-9", to: "+34600111222" });
    expect(fake.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "image",
      status: "sent",
      external_id: "wamid.IMAGE",
    });
    expect(fake.rows[0]!.media).toMatchObject({
      source: "nexo_report",
      report_type: "weekly",
      report_format: "image",
      group_id: "bk",
    });
    expect(fake.touches[0]!.preview).toBe("🖼️ Informe semanal · Burger King");
  });

  it("trimestral: usa el periodo trimestral y la red elegida", async () => {
    expect((await post(quarterly)).status).toBe(200);
    expect(captureNetworkSummaryPng).toHaveBeenCalledWith("trimestral", "sg-es", "https://nexo.example", 0);
    expect(fake.touches[0]!.preview).toBe("🖼️ Informe trimestral · Santa Gloria España");
  });

  it("la respuesta no contiene token, bytes, raw_payload ni ids de Meta", async () => {
    const json = await (await post(weekly)).json();
    expect(json.messages[0]).toMatchObject({ contentType: "image", label: "🖼️ Informe de Nexo" });
    const raw = JSON.stringify(json);
    for (const forbidden of [TOKEN, "raw_payload", "MEDIA-9", "wamid.IMAGE", "external_id", "client_request_id", "+34600111222", "iVBOR"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("doble requestId: una sola imagen; incierto: el retry no regenera ni reenvía", async () => {
    await post(weekly);
    expect((await post(weekly)).status).toBe(200);
    expect(captureNetworkSummaryPng).toHaveBeenCalledTimes(1);
    expect(sendImageMessage).toHaveBeenCalledTimes(1);

    fake = createFakeOutboundRepo();
    sendImageMessage.mockResolvedValue({ status: "unconfirmed" });
    const other = { ...weekly, requestId: "44444444-4444-4444-8444-444444444444" };
    expect((await post(other)).status).toBe(502);
    expect((await post(other)).status).toBe(409);
    expect(captureNetworkSummaryPng).toHaveBeenCalledTimes(2);
  });

  it("fallo al capturar la plantilla → 500 seguro y no se envía nada", async () => {
    captureNetworkSummaryPng.mockRejectedValue(new Error("template down"));
    const res = await post(weekly);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("generation_failed");
    expect(uploadMedia).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversations/report-options", () => {
  const get = () => optionsRoute(new Request("https://nexo.example/api/conversations/report-options"));

  it("no super_admin → 403", async () => {
    asRole("empresa_admin");
    expect((await get()).status).toBe(403);
    expect(listReportableRestaurants).not.toHaveBeenCalled();
  });

  it("super_admin recibe solo los tipos habilitados, con formatos y periodos propios de cada uno", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.types.map((t: { id: string }) => t.id)).toEqual(["weekly", "monthly", "quarterly"]);
    const byId = Object.fromEntries(json.types.map((t: { id: string }) => [t.id, t]));

    expect(byId.monthly.formats).toEqual([
      { id: "pdf", label: "PDF" },
      { id: "image", label: "Imagen" },
    ]);
    expect(byId.weekly.formats).toEqual([{ id: "image", label: "Imagen" }]);
    expect(byId.quarterly.formats).toEqual([{ id: "image", label: "Imagen" }]);

    expect(byId.monthly.subject).toBe("restaurant");
    expect(byId.weekly.subject).toBe("network_group");
    expect(byId.monthly.periods).toHaveLength(12);
    expect(byId.weekly.periods).toHaveLength(12);
    expect(byId.quarterly.periods).toHaveLength(8);
    expect(byId.monthly.periods[0].label).toMatch(/^[A-Z][a-zé]+ \d{4}$/);
    expect(byId.quarterly.periods[0].label).toMatch(/^T[1-4] \d{4} \(/);

    expect(json.restaurants).toEqual([{ id: 123, name: "BK Zizur", brand: "Burger King", city: "Zizur" }]);
    expect(json.groups.map((g: { id: string }) => g.id)).toEqual(["bk", "pp", "sg-es", "sg-ad", "th", "hambar", "vault"]);
    expect(listReportableRestaurants).toHaveBeenCalledWith(expect.objectContaining({ rol: "super_admin" }));
    // Los tipos previstos no aparecen.
    expect(JSON.stringify(json)).not.toMatch(/semiannual|annual/);
  });
});
