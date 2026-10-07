import { describe, expect, it, vi } from "vitest";
import { parseSendTextBody, sendTextMessageToConversation } from "@/lib/conversations/send-text";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
  makeContext,
} from "@/lib/conversations/outbound-fake.test-helper";
import type { SendTextResult } from "@/lib/whatsapp/cloud-api.server";

const input = { conversationId: CONVERSATION_ID, requestId: REQUEST_ID, text: "Hola, ¿todo bien?" };
const silent = { error: () => {} };

function setup(
  result: SendTextResult | (() => Promise<SendTextResult>),
  repoOptions: Parameters<typeof createFakeOutboundRepo>[0] = {},
  configured = true
) {
  const fake = createFakeOutboundRepo(repoOptions);
  const sendText = vi.fn(typeof result === "function" ? result : async () => result);
  const run = (over: Partial<typeof input> = {}) =>
    sendTextMessageToConversation(
      { ...input, ...over },
      { repository: fake.repo, sendText, isConfigured: () => configured, logger: silent }
    );
  return { ...fake, sendText, run };
}

describe("sendTextMessageToConversation", () => {
  it("conversación inexistente → not_found y no se envía", async () => {
    const t = setup({ status: "sent", wamid: "w" }, { context: null });
    expect(await t.run()).toEqual({ status: "not_found" });
    expect(t.sendText).not.toHaveBeenCalled();
  });

  it("canal inactivo → channel_inactive sin reservar ni enviar", async () => {
    const t = setup({ status: "sent", wamid: "w" }, { context: makeContext({ status: "disabled" }) });
    expect(await t.run()).toEqual({ status: "channel_inactive" });
    expect(t.rows).toHaveLength(0);
    expect(t.sendText).not.toHaveBeenCalled();
  });

  it("sin token → misconfigured sin reservar ni enviar", async () => {
    const t = setup({ status: "sent", wamid: "w" }, {}, false);
    expect(await t.run()).toEqual({ status: "misconfigured" });
    expect(t.rows).toHaveLength(0);
    expect(t.sendText).not.toHaveBeenCalled();
  });

  it("éxito: persiste outbound/human/text/sent con el wamid y actualiza la vista previa", async () => {
    const t = setup({ status: "sent", wamid: "wamid.ABC" });
    const outcome = await t.run();

    expect(outcome.status).toBe("sent");
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "text",
      text: input.text,
      external_id: "wamid.ABC",
      status: "sent",
      media: null,
    });
    expect(t.touches).toHaveLength(1);
    expect(t.touches[0]!.preview).toBe(input.text);
  });

  it("el teléfono y el phone_number_id salen del servidor (contexto), no de la petición", async () => {
    const t = setup({ status: "sent", wamid: "w" });
    await t.run();
    expect(t.sendText).toHaveBeenCalledWith({
      phoneNumberId: "1365004563368241",
      to: "+34600111222",
      text: input.text,
    });
  });

  it("doble envío con el mismo requestId: un solo WhatsApp", async () => {
    const t = setup({ status: "sent", wamid: "wamid.ABC" });
    const first = await t.run();
    const second = await t.run();

    expect(t.sendText).toHaveBeenCalledTimes(1);
    expect(t.rows).toHaveLength(1);
    expect(first.status).toBe("sent");
    expect(second).toMatchObject({ status: "sent", deduplicated: true });
  });

  it("peticiones simultáneas con el mismo requestId: un solo WhatsApp", async () => {
    const t = setup({ status: "sent", wamid: "wamid.ABC" });
    const [a, b] = await Promise.all([t.run(), t.run()]);
    expect(t.sendText).toHaveBeenCalledTimes(1);
    expect([a.status, b.status].sort()).toEqual(["in_progress", "sent"]);
  });

  it("rechazo de Meta (4xx): marca failed, sin duplicados, y el reintento reutiliza la misma fila", async () => {
    let calls = 0;
    const t = setup(async () =>
      ++calls === 1 ? { status: "rejected", reason: "other" } : { status: "sent", wamid: "wamid.OK" }
    );

    expect(await t.run()).toEqual({ status: "rejected", reason: "other" });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]!.status).toBe("failed");
    expect(t.touches).toHaveLength(0);

    expect((await t.run()).status).toBe("sent");
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ status: "sent", external_id: "wamid.OK" });
  });

  it("resultado incierto (timeout/5xx): queda pending y el reintento NO reenvía", async () => {
    const t = setup({ status: "unconfirmed" });
    expect(await t.run()).toEqual({ status: "unconfirmed" });
    expect(t.rows[0]!.status).toBe("pending");

    expect(await t.run()).toEqual({ status: "in_progress" });
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });

  it("Meta acepta pero falla guardar: no hay segundo envío al reintentar", async () => {
    const t = setup({ status: "sent", wamid: "wamid.LOST" }, { markSentFailures: 99 });
    const logger = { error: vi.fn() };
    const outcome = await sendTextMessageToConversation(input, {
      repository: t.repo,
      sendText: t.sendText,
      isConfigured: () => true,
      logger,
    });

    expect(outcome).toEqual({ status: "sent_not_saved" });
    expect(t.rows[0]!.status).toBe("pending");
    // Se registra para conciliar, sin texto ni teléfono.
    const logged = logger.error.mock.calls[0]![0] as string;
    expect(logged).toContain("wamid.LOST");
    expect(logged).not.toContain(input.text);
    expect(logged).not.toContain("+34600111222");

    expect(await t.run()).toEqual({ status: "in_progress" });
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });

  it("un fallo puntual al guardar se reintenta sin reenviar", async () => {
    const t = setup({ status: "sent", wamid: "wamid.ABC" }, { markSentFailures: 1 });
    expect((await t.run()).status).toBe("sent");
    expect(t.sendText).toHaveBeenCalledTimes(1);
    expect(t.rows[0]!.status).toBe("sent");
  });

  it("el mismo requestId con otro texto → request_conflict", async () => {
    const t = setup({ status: "sent", wamid: "w" });
    await t.run();
    expect(await t.run({ text: "otro texto" })).toEqual({ status: "request_conflict" });
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });
});

describe("parseSendTextBody", () => {
  it("recorta el texto y acepta un requestId UUID", () => {
    expect(parseSendTextBody({ text: "  hola  ", requestId: REQUEST_ID })).toEqual({
      ok: true,
      text: "hola",
      requestId: REQUEST_ID,
    });
  });

  it("rechaza texto vacío, requestId inválido, tipos incorrectos y textos enormes", () => {
    expect(parseSendTextBody({ text: "   ", requestId: REQUEST_ID }).ok).toBe(false);
    expect(parseSendTextBody({ text: "hola", requestId: "x" }).ok).toBe(false);
    expect(parseSendTextBody({ text: 5, requestId: REQUEST_ID }).ok).toBe(false);
    expect(parseSendTextBody(null).ok).toBe(false);
    expect(parseSendTextBody({ text: "a".repeat(4097), requestId: REQUEST_ID }).ok).toBe(false);
  });

  it("ignora teléfono, canal y sender enviados por el navegador", () => {
    const parsed = parseSendTextBody({
      text: "hola",
      requestId: REQUEST_ID,
      to: "+34999999999",
      phone_number_id: "1",
      canal_id: "x",
      sender_type: "ai",
    });
    expect(parsed).toEqual({ ok: true, text: "hola", requestId: REQUEST_ID });
  });
});
