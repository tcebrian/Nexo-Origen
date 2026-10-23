import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processNegativeAlert = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/alerts/negative-review/process.server", () => ({ processNegativeAlert }));

const route = await import("@/app/api/webhooks/negative-review-alert/route");

const SECRET = "secreto-alertas-negativas";
const post = (headers: Record<string, string> = {}) =>
  route.POST(
    new Request("https://nexo.example/api/webhooks/negative-review-alert", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "INSERT", record: { id: 42 } }),
    }),
  );

describe("POST /api/webhooks/negative-review-alert (autenticación)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    processNegativeAlert.mockResolvedValue({ status: "processed", recipients: 1, outcomes: [{ outcome: "sent" }] });
    process.env.NEGATIVE_REVIEW_WEBHOOK_SECRET = SECRET;
    process.env.WHATSAPP_WEBHOOK_SECRET = "secreto-whatsapp";
  });

  afterEach(() => {
    delete process.env.NEGATIVE_REVIEW_WEBHOOK_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
  });

  it("secreto correcto → acepta y procesa", async () => {
    const res = await post({ "x-webhook-secret": SECRET });
    expect(res.status).toBe(200);
    expect(processNegativeAlert).toHaveBeenCalledWith(42);
  });

  it("secreto incorrecto (incluido el de WhatsApp) → 401 sin procesar", async () => {
    expect((await post({ "x-webhook-secret": "otro" })).status).toBe(401);
    expect((await post({ "x-webhook-secret": "secreto-whatsapp" })).status).toBe(401);
    expect(processNegativeAlert).not.toHaveBeenCalled();
  });

  it("cabecera ausente → 401", async () => {
    expect((await post()).status).toBe(401);
    expect(processNegativeAlert).not.toHaveBeenCalled();
  });

  it("variable de entorno ausente o vacía → falla cerrada (401)", async () => {
    delete process.env.NEGATIVE_REVIEW_WEBHOOK_SECRET;
    expect((await post({ "x-webhook-secret": SECRET })).status).toBe(401);
    process.env.NEGATIVE_REVIEW_WEBHOOK_SECRET = "";
    expect((await post({ "x-webhook-secret": "" })).status).toBe(401);
    expect(processNegativeAlert).not.toHaveBeenCalled();
  });
});
