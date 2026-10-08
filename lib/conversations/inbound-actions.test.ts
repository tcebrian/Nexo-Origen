import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleWebhookEvent } from "@/lib/conversations/channels/whatsapp-cloud/webhook-handler";
import {
  ACTIVATION_REPLY,
  ALERTS_REQUEST_REPLY,
  REPORT_REQUEST_REPLY,
  handleInboundAction,
  type InboundActivationRepository,
} from "@/lib/conversations/inbound-actions";
import type { IngestInboundResult } from "@/lib/conversations/ingest-inbound";
import type { InboundMessage } from "@/lib/conversations/types";

const NOW = new Date("2026-10-08T09:30:00.000Z");

function message(over: Partial<InboundMessage> = {}): InboundMessage {
  return {
    externalMessageId: "wamid.IN1",
    channelExternalId: "100000000000001",
    senderPhone: "+34600000001",
    contentType: "text",
    providerTimestamp: new Date("2026-10-08T09:29:00.000Z"),
    ...over,
  };
}
const button = (id: string, title: string) => message({ text: title, interactive: { id, title } });

function setup(initial: { activatedAt?: string | null; exists?: boolean } = {}) {
  const state = { activatedAt: initial.activatedAt ?? null, exists: initial.exists ?? true, writes: 0 };
  const permissionTouches: string[] = [];
  const activations: InboundActivationRepository = {
    async isActivated() {
      return state.exists ? state.activatedAt !== null : null;
    },
    async markActivated(_id, at) {
      if (state.activatedAt) return false;
      state.activatedAt = at.toISOString();
      state.writes++;
      return true;
    },
  };
  const replies: { conversationId: string; requestId: string; text: string }[] = [];
  const sendReply = vi.fn(async (reply: { conversationId: string; requestId: string; text: string }) => {
    replies.push(reply);
  });
  const run = (msg: InboundMessage, redelivery = false) =>
    handleInboundAction(
      { message: msg, contactId: "contact-1", conversationId: "conv-1", redelivery },
      { activations, sendReply, now: () => NOW }
    );
  return { state, replies, sendReply, permissionTouches, run };
}

describe("Activar servicio", () => {
  it("el botón activa el contacto, guarda la fecha y responde el mensaje de confirmación", async () => {
    const t = setup();
    expect(await t.run(button("nexo:activate_service", "Activar servicio"))).toEqual({ action: "ACTIVATE_SERVICE" });
    expect(t.state.activatedAt).toBe(NOW.toISOString());
    expect(t.replies).toHaveLength(1);
    expect(t.replies[0]).toMatchObject({ conversationId: "conv-1", text: ACTIVATION_REPLY });
    expect(ACTIVATION_REPLY).toContain("✅ Servicio activado.");
  });

  it("el texto OK / ok / Ok activa si está pendiente", async () => {
    for (const text of ["OK", "ok", "Ok"]) {
      const t = setup();
      expect(await t.run(message({ text }))).toEqual({ action: "ACTIVATE_SERVICE" });
      expect(t.state.activatedAt).toBe(NOW.toISOString());
    }
  });

  it("segundo OK o segundo clic: no cambia la fecha, no duplica la activación ni responde otra vez", async () => {
    const t = setup();
    await t.run(button("nexo:activate_service", "Activar servicio"));
    const first = t.state.activatedAt;

    await handleInboundAction(
      { message: message({ externalMessageId: "wamid.IN2", text: "ok" }), contactId: "contact-1", conversationId: "conv-1", redelivery: false },
      { activations: { isActivated: async () => true, markActivated: async () => false }, sendReply: t.sendReply, now: () => new Date("2027-01-01") }
    );
    const second = await t.run(button("nexo:activate_service", "Activar servicio"));

    expect(second).toEqual({ action: "ACTIVATE_SERVICE" });
    expect(t.state.activatedAt).toBe(first);
    expect(t.state.writes).toBe(1);
    expect(t.replies).toHaveLength(1);
  });

  it("un OK posterior con el contacto ya activo no es ninguna acción", async () => {
    const t = setup({ activatedAt: "2026-10-01T10:00:00.000Z" });
    expect(await t.run(message({ text: "ok" }))).toEqual({ action: "UNKNOWN" });
    expect(t.replies).toHaveLength(0);
    expect(t.state.activatedAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("reentrega del webhook: la respuesta usa el mismo id (no se duplica) y la fecha no cambia", async () => {
    const t = setup();
    const msg = button("nexo:activate_service", "Activar servicio");
    await t.run(msg);
    await t.run(msg, true);
    expect(t.replies).toHaveLength(2);
    expect(t.replies[0]!.requestId).toBe(t.replies[1]!.requestId); // el envío lo deduplica por este id
    expect(t.state.writes).toBe(1);
  });

  it("activar no toca permisos: el repositorio de activación solo expone dos operaciones", async () => {
    const t = setup();
    await t.run(button("nexo:activate_service", "Activar servicio"));
    expect(t.permissionTouches).toEqual([]);
  });

  it("contacto desconocido no gana nada: sin contacto no se ejecuta acción", async () => {
    const t = setup({ exists: false });
    expect(await t.run(button("nexo:activate_service", "Activar servicio"))).toEqual({ action: "skipped" });
    expect(t.replies).toHaveLength(0);
  });
});

describe("Ver informe / Ver alertas (preparados)", () => {
  it("Ver informe se reconoce y responde la recepción, sin informe real", async () => {
    const t = setup({ activatedAt: NOW.toISOString() });
    expect(await t.run(button("nexo:view_daily_report", "Ver informe"))).toEqual({ action: "VIEW_DAILY_REPORT" });
    expect(t.replies.map((r) => r.text)).toEqual([REPORT_REQUEST_REPLY]);
    expect(REPORT_REQUEST_REPLY).toBe("📊 Solicitud de informe recibida.");
  });

  it("Ver alertas se reconoce y responde la recepción, sin alertas reales", async () => {
    const t = setup({ activatedAt: NOW.toISOString() });
    expect(await t.run(button("nexo:view_pending_alerts", "Ver alertas"))).toEqual({ action: "VIEW_PENDING_ALERTS" });
    expect(t.replies.map((r) => r.text)).toEqual([ALERTS_REQUEST_REPLY]);
    expect(ALERTS_REQUEST_REPLY).toBe("🚨 Solicitud de alertas recibida.");
  });

  it("Ver informe no activa el contacto", async () => {
    const t = setup();
    await t.run(button("nexo:view_daily_report", "Ver informe"));
    expect(t.state.activatedAt).toBeNull();
  });

  it("el id de respuesta es distinto para cada mensaje entrante y para cada acción", async () => {
    const t = setup({ activatedAt: NOW.toISOString() });
    await t.run({ ...button("nexo:view_daily_report", "Ver informe"), externalMessageId: "wamid.A" });
    await t.run({ ...button("nexo:view_daily_report", "Ver informe"), externalMessageId: "wamid.B" });
    await t.run({ ...button("nexo:view_pending_alerts", "Ver alertas"), externalMessageId: "wamid.A" });
    expect(new Set(t.replies.map((r) => r.requestId)).size).toBe(3);
  });
});

describe("mensajes que no son acciones", () => {
  it("botón desconocido: no se ejecuta ni se responde nada", async () => {
    const t = setup();
    expect(await t.run(button("nexo:borrar", "Borrar todo"))).toEqual({ action: "UNKNOWN" });
    expect(t.replies).toHaveLength(0);
    expect(t.state.activatedAt).toBeNull();
  });

  it("texto libre, imágenes o audios: nada", async () => {
    const t = setup();
    expect(await t.run(message({ text: "hola, ok gracias" }))).toEqual({ action: "UNKNOWN" });
    expect(await t.run(message({ contentType: "image" }))).toEqual({ action: "skipped" });
    expect(t.replies).toHaveLength(0);
  });
});

// Webhook ------------------------------------------------------------------------------------

const SECRET = "test-app-secret-not-real";
const silent = { info: () => {}, error: () => {} };

function buttonWebhook(id = "wamid.IN1", payload = "nexo:activate_service", text = "Activar servicio") {
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "100000000000001" },
              messages: [{ from: "34600000001", id, timestamp: "1760000000", type: "button", button: { payload, text } }],
            },
          },
        ],
      },
    ],
  });
  return { rawBody: new TextEncoder().encode(raw), signature: `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}` };
}

describe("webhook con botones", () => {
  const stored = (status: "stored" | "duplicate"): IngestInboundResult => ({
    status,
    channelId: "ch",
    contactId: "contact-1",
    conversationId: "conv-1",
    contactCreated: false,
    conversationCreated: false,
    lastMessageUpdated: true,
  });
  const deps = (over: Record<string, unknown> = {}) => ({
    appSecret: SECRET,
    ingest: vi.fn(async () => stored("stored")),
    applyStatus: vi.fn(async () => ({ status: "updated" }) as never),
    logger: silent,
    ...over,
  });

  it("guarda el inbound y dispara la acción con el mensaje y su contacto", async () => {
    const handleAction = vi.fn(async () => undefined);
    const d = deps({ handleAction });
    const result = await handleWebhookEvent(buttonWebhook(), d as never);

    expect(result.status).toBe(200);
    expect(d.ingest).toHaveBeenCalledTimes(1);
    expect(d.ingest.mock.calls[0]![0]).toMatchObject({ contentType: "text", text: "Activar servicio", interactive: { id: "nexo:activate_service" } });
    expect(handleAction).toHaveBeenCalledWith(expect.objectContaining({ externalMessageId: "wamid.IN1" }), {
      contactId: "contact-1",
      conversationId: "conv-1",
      redelivery: false,
    });
  });

  it("una reentrega (duplicado) vuelve a ofrecer la acción, marcada como reentrega", async () => {
    const handleAction = vi.fn(async () => undefined);
    const d = deps({ handleAction, ingest: vi.fn(async () => stored("duplicate")) });
    expect((await handleWebhookEvent(buttonWebhook(), d as never)).status).toBe(200);
    expect(handleAction.mock.calls[0]![1]).toMatchObject({ redelivery: true });
  });

  it("canal desconocido o inactivo: no hay acción", async () => {
    const handleAction = vi.fn();
    const d = deps({ handleAction, ingest: vi.fn(async () => ({ status: "channel_not_found" })) });
    await handleWebhookEvent(buttonWebhook(), d as never);
    expect(handleAction).not.toHaveBeenCalled();
  });

  it("si la acción falla por la base de datos, el lote responde 500 para que Meta reentregue", async () => {
    const d = deps({ handleAction: vi.fn(async () => { throw new Error("db down"); }) });
    expect((await handleWebhookEvent(buttonWebhook(), d as never)).status).toBe(500);
  });

  it("sin firma válida no se ingiere ni se actúa", async () => {
    const handleAction = vi.fn();
    const d = deps({ handleAction });
    const input = { ...buttonWebhook(), signature: "sha256=00" };
    expect((await handleWebhookEvent(input, d as never)).status).toBe(401);
    expect(d.ingest).not.toHaveBeenCalled();
    expect(handleAction).not.toHaveBeenCalled();
  });

  it("los estados sent/delivered/read/failed siguen aplicándose igual", async () => {
    const raw = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "100000000000001" },
                statuses: [{ id: "wamid.OUT1", status: "delivered", timestamp: "1760000100", recipient_id: "34600000001" }],
              },
            },
          ],
        },
      ],
    });
    const handleAction = vi.fn();
    const d = deps({ handleAction });
    const result = await handleWebhookEvent(
      { rawBody: new TextEncoder().encode(raw), signature: `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}` },
      d as never
    );
    expect(result.status).toBe(200);
    expect(d.applyStatus).toHaveBeenCalledWith(expect.objectContaining({ externalMessageId: "wamid.OUT1", status: "delivered" }));
    expect(handleAction).not.toHaveBeenCalled();
  });
});
