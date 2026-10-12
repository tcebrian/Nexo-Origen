import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { ContactActivation, ContactActivationRepository } from "@/lib/conversations/contact-activation";
import { CONVERSATION_ID, REQUEST_ID, createFakeOutboundRepo } from "@/lib/conversations/outbound-fake.test-helper";
import { TEST_ALERT_COUNT, buildTestTemplateRequest, formatSpanishLongDate, isTestTemplateKind, sendTestTemplate } from "@/lib/conversations/template-test";
import type { SendMessageResult } from "@/lib/whatsapp/cloud-api.server";

const NOW = new Date("2026-10-08T09:00:00.000Z");

describe("variables de la prueba", () => {
  it("fecha en español y nombre real del contacto", () => {
    expect(formatSpanishLongDate(NOW)).toBe("8 de octubre de 2026");
    expect(buildTestTemplateRequest("daily_report", { name: "tomas", now: NOW })).toEqual({
      name: "informe_diario",
      language: "es",
      bodyParams: ["tomas", "8 de octubre de 2026"],
      buttonPayloads: [],
    });
  });

  it("alerta negativa: nombre y número de alertas = 1, en inglés (idioma registrado en Meta)", () => {
    expect(TEST_ALERT_COUNT).toBe("1");
    expect(buildTestTemplateRequest("negative_alert", { name: "tomas", now: NOW })).toEqual({
      name: "alerta_negativa",
      language: "en",
      bodyParams: ["tomas", "1"],
      buttonPayloads: [],
    });
  });

  it("sin nombre usa un texto neutro; el tipo solo puede ser uno de los dos", () => {
    expect(buildTestTemplateRequest("daily_report", { name: "  ", now: NOW }).bodyParams[0]).toBe("equipo");
    for (const bad of ["welcome", "informe_diario", "", null, 3, "__proto__"]) expect(isTestTemplateKind(bad)).toBe(false);
    expect(isTestTemplateKind("daily_report")).toBe(true);
  });
});

function setup(over: { contact?: Partial<ContactActivation> | null; send?: () => Promise<SendMessageResult> } = {}) {
  const fake = createFakeOutboundRepo();
  const contact: ContactActivation | null =
    over.contact === null
      ? null
      : { id: "contact-1", phone: "+34600111222", name: "tomas", welcomeSentAt: null, activatedAt: null, ...over.contact };
  const marks: unknown[] = [];
  const activations: ContactActivationRepository = {
    async getByConversation(id) {
      return contact && id === CONVERSATION_ID ? { ...contact } : null;
    },
    async markWelcomeSent() {
      marks.push("welcome_sent_at");
      return true;
    },
  };
  const sendTemplate = vi.fn(over.send ?? (async () => ({ status: "sent", wamid: "wamid.TEST1" }) as const));
  const sendText = vi.fn();
  const run = (kind: "daily_report" | "negative_alert" = "daily_report", requestId = REQUEST_ID) =>
    sendTestTemplate(
      { conversationId: CONVERSATION_ID, kind, requestId },
      {
        activations,
        sendTemplate,
        now: () => NOW,
        send: { repository: fake.repo, sendText, uploadMedia: vi.fn(), sendDocument: vi.fn(), sendImage: vi.fn(), isConfigured: () => true, logger: { error: () => {} } },
      }
    );
  return { ...fake, contact, marks, sendTemplate, sendText, run };
}

describe("envío de la prueba por el sistema de Conversations", () => {
  it("informe diario: una plantilla, un mensaje outbound reservado y marcado como enviado", async () => {
    const t = setup();
    const outcome = await t.run("daily_report");
    expect(outcome).toMatchObject({ status: "sent", template: "informe_diario" });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);
    expect(t.sendTemplate).toHaveBeenCalledWith({
      phoneNumberId: "1365004563368241",
      to: "+34600111222",
      template: { name: "informe_diario", language: "es", bodyParams: ["tomas", "8 de octubre de 2026"], buttonPayloads: [] },
    });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ direction: "outbound", status: "sent", external_id: "wamid.TEST1", client_request_id: REQUEST_ID });
    expect(t.rows[0]!.text).toContain("(prueba)");
    expect(t.rows[0]!.text).not.toMatch(/tomas|\+34/);
    expect(t.sendText).not.toHaveBeenCalled();
  });

  it("alerta negativa: idioma en y número de alertas 1", async () => {
    const t = setup();
    expect(await t.run("negative_alert")).toMatchObject({ status: "sent", template: "alerta_negativa" });
    expect(t.sendTemplate.mock.calls[0]![0].template).toEqual({
      name: "alerta_negativa",
      language: "en",
      bodyParams: ["tomas", "1"],
      buttonPayloads: [],
    });
  });

  it("no marca ninguna automatización ni toca la activación o los permisos", async () => {
    const t = setup();
    await t.run("daily_report");
    expect(t.marks).toEqual([]); // markWelcomeSent no se llama
    expect(t.contact!.welcomeSentAt).toBeNull();
    expect(t.contact!.activatedAt).toBeNull();
  });

  it("doble clic con el mismo requestId: una sola plantilla; otra pulsación envía otra", async () => {
    const t = setup();
    await t.run("daily_report", REQUEST_ID);
    const again = await t.run("daily_report", REQUEST_ID);
    expect(again).toMatchObject({ status: "sent" });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);

    await t.run("daily_report", "11111111-2222-4333-8444-555555555555");
    expect(t.sendTemplate).toHaveBeenCalledTimes(2);
  });

  it("si Meta rechaza, devuelve el error saneado y el mensaje queda fallido", async () => {
    const t = setup({
      send: async () => ({ status: "rejected", reason: "other", error: { httpStatus: 404, code: 132001, details: "template name (informe_diario) does not exist in en" } }),
    });
    const outcome = await t.run("daily_report");
    expect(outcome).toMatchObject({ status: "rejected", template: "informe_diario", providerError: { code: 132001 } });
    expect(t.rows[0]!.status).toBe("failed");
  });

  it("conversación inexistente → contact_not_found y no se envía nada", async () => {
    const t = setup({ contact: null });
    expect(await t.run()).toEqual({ status: "contact_not_found" });
    expect(t.sendTemplate).not.toHaveBeenCalled();
  });
});

// Ruta -----------------------------------------------------------------------------------------------
const requireApiAuth = vi.fn();
const sendManualTestTemplate = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
const runManualDailyReportForConversation = vi.fn();
vi.mock("@/lib/conversations/contact-activation.server", () => ({ sendManualTestTemplate }));
const runManualNegativeAlertForConversation = vi.fn();
vi.mock("@/lib/reports/daily/process.server", () => ({ runManualDailyReportForConversation }));
vi.mock("@/lib/alerts/negative-review/process.server", () => ({ runManualNegativeAlertForConversation }));

const route = await import("@/app/api/conversations/[conversationId]/template-test/route");
const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "u-1", perfil: { rol }, scope: {} } });
const post = (body: unknown, id = CONVERSATION_ID) =>
  route.POST(
    new Request(`https://nexo.example/api/conversations/${id}/template-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ conversationId: id }) }
  );

describe("POST /api/conversations/[id]/template-test", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asRole("super_admin");
    sendManualTestTemplate.mockResolvedValue({ status: "sent", messages: [], template: "informe_diario" });
    runManualDailyReportForConversation.mockResolvedValue({
      status: "sent",
      envioId: "envio-1",
      restaurants: 3,
      slot: { kind: "WEEK_TO_DATE", slotDate: "2026-10-13", periodStart: "2026-10-12T00:00:00", periodEnd: "2026-10-13T09:00:00" },
    });
  });

  it("informe diario: ejecuta el flujo real del job y NO el envío suelto de plantilla", async () => {
    const res = await post({ kind: "daily_report", requestId: REQUEST_ID });
    expect(res.status).toBe(200);
    expect(runManualDailyReportForConversation).toHaveBeenCalledWith({ conversationId: CONVERSATION_ID, requestId: REQUEST_ID });
    expect(sendManualTestTemplate).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ template: "informe_diario", report: { kind: "WEEK_TO_DATE", restaurants: 3 } });
  });

  it("informe diario sin restaurantes asignados: 409 y no se envía nada (deny by default)", async () => {
    runManualDailyReportForConversation.mockResolvedValue({ status: "no_restaurants" });
    const res = await post({ kind: "daily_report", requestId: REQUEST_ID });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("no_restaurants");
  });

  it("alerta negativa: ejecuta el flujo real de alertas (no la plantilla suelta) y no toca el informe", async () => {
    runManualNegativeAlertForConversation.mockResolvedValue({
      status: "done",
      resenaId: 501,
      result: { status: "processed", restaurantId: 7, recipients: 1, outcomes: [{ contactId: "c-1", outcome: "delivered_direct" }] },
    });
    const res = await post({ kind: "negative_alert", requestId: REQUEST_ID });
    expect(res.status).toBe(200);
    expect(runManualNegativeAlertForConversation).toHaveBeenCalledWith({ conversationId: CONVERSATION_ID, forceTemplate: false });
    expect(sendManualTestTemplate).not.toHaveBeenCalled();
    expect(runManualDailyReportForConversation).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ alert: { outcome: "delivered_direct", resenaId: 501 } });

    await post({ kind: "negative_alert_template", requestId: REQUEST_ID });
    expect(runManualNegativeAlertForConversation).toHaveBeenLastCalledWith({ conversationId: CONVERSATION_ID, forceTemplate: true });
  });

  it("alerta negativa sin restaurantes o sin reseñas negativas: 409 y nada se envía", async () => {
    runManualNegativeAlertForConversation.mockResolvedValue({ status: "no_restaurants" });
    expect((await post({ kind: "negative_alert", requestId: REQUEST_ID })).status).toBe(409);
    runManualNegativeAlertForConversation.mockResolvedValue({ status: "no_negative_review" });
    expect((await post({ kind: "negative_alert", requestId: REQUEST_ID })).status).toBe(409);
  });

  it("solo super_admin", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await post({ kind: "daily_report", requestId: REQUEST_ID })).status).toBe(401);
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      asRole(rol);
      expect((await post({ kind: "daily_report", requestId: REQUEST_ID })).status).toBe(403);
    }
    expect(sendManualTestTemplate).not.toHaveBeenCalled();
    expect(runManualDailyReportForConversation).not.toHaveBeenCalled();
    expect(runManualNegativeAlertForConversation).not.toHaveBeenCalled();
  });

  it("el navegador solo elige el tipo: nada de nombre de plantilla, idioma, teléfono ni variables", async () => {
    expect((await post({ kind: "informe_diario", requestId: REQUEST_ID })).status).toBe(400);
    expect((await post({ kind: "daily_report" })).status).toBe(400);
    expect((await post({ kind: "daily_report", requestId: "no-uuid" })).status).toBe(400);
    expect((await post({ kind: "daily_report", requestId: REQUEST_ID }, "nope")).status).toBe(400);

    runManualNegativeAlertForConversation.mockResolvedValue({ status: "no_restaurants" });
    await post({ kind: "negative_alert", requestId: REQUEST_ID, template: "x", language: "es", to: "+34000000000", params: ["a"] });
    expect(runManualNegativeAlertForConversation).toHaveBeenCalledWith({ conversationId: CONVERSATION_ID, forceTemplate: false });
  });

  it("alerta negativa que no se puede enviar → 502 y el log no lleva teléfono, nombre ni token", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    runManualNegativeAlertForConversation.mockResolvedValue({
      status: "done",
      resenaId: 501,
      result: { status: "processed", restaurantId: 7, recipients: 1, outcomes: [{ contactId: "c-1", outcome: "pending_template_failed" }] },
    });
    const res = await post({ kind: "negative_alert_template", requestId: REQUEST_ID });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "No se pudo enviar la alerta de prueba", code: "pending_template_failed" });
    const line = String(spy.mock.calls[0]![0]);
    expect(line).toContain("outcome=pending_template_failed");
    expect(line).not.toMatch(/\+?\d{8,}|token|Bearer/i);
    spy.mockRestore();
  });
});

describe("interfaz temporal", () => {
  const panel = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/_components/contact-info-panel.tsx"), "utf-8");

  it("dos botones en una tarjeta marcada como temporal, que llaman a la ruta de prueba", () => {
    expect(panel).toContain("Probar informe diario");
    expect(panel).toContain("Probar alerta negativa");
    expect(panel).toContain("Probar alerta (forzar plantilla)");
    expect(panel).toContain("Temporal");
    expect(panel).toContain("/template-test");
    // No manda plantilla, idioma ni variables: solo el tipo y un id por pulsación.
    expect(panel).toContain("JSON.stringify({ kind, requestId: crypto.randomUUID() })");
  });
});
