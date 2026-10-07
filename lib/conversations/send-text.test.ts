import { describe, expect, it, vi } from "vitest";
import {
  parseSendFields,
  sendConversationOperation,
  type SendDocument,
} from "@/lib/conversations/send-text";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
  makeContext,
} from "@/lib/conversations/outbound-fake.test-helper";
import { splitText } from "@/lib/conversations/text-chunks";
import type { SendMessageResult, UploadMediaResult } from "@/lib/whatsapp/cloud-api.server";

const silent = { error: () => {} };
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

function makeDocument(over: Partial<SendDocument> = {}): SendDocument & { produce: ReturnType<typeof vi.fn> } {
  return {
    media: {
      mime_type: "application/pdf",
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
      source: "nexo_report",
      report_type: "monthly",
      restaurant_id: 123,
      period: "2026-09",
    },
    preview: "📊 Informe mensual · BK Zizur",
    produce: vi.fn(async () => PDF),
    ...over,
  } as SendDocument & { produce: ReturnType<typeof vi.fn> };
}

type Results = {
  text?: () => Promise<SendMessageResult>;
  upload?: () => Promise<UploadMediaResult>;
  media?: () => Promise<SendMessageResult>;
};

function setup(
  results: Results = {},
  repoOptions: Parameters<typeof createFakeOutboundRepo>[0] = {},
  configured = true
) {
  const fake = createFakeOutboundRepo(repoOptions);
  let n = 0;
  const sendText = vi.fn(results.text ?? (async () => ({ status: "sent", wamid: `wamid.T${++n}` }) as const));
  const uploadMedia = vi.fn(results.upload ?? (async () => ({ status: "uploaded", mediaId: "MEDIA-1" }) as const));
  const sendDocument = vi.fn(results.media ?? (async () => ({ status: "sent", wamid: "wamid.DOC" }) as const));

  const run = (
    over: { text?: string; document?: SendDocument; requestId?: string; conversationId?: string } = {}
  ) =>
    sendConversationOperation(
      { conversationId: CONVERSATION_ID, requestId: REQUEST_ID, text: "Hola, ¿todo bien?", ...over },
      {
        repository: fake.repo,
        sendText,
        uploadMedia,
        sendDocument,
        isConfigured: () => configured,
        logger: silent,
      }
    );
  return { ...fake, sendText, uploadMedia, sendDocument, run };
}

const sentMessages = (o: Awaited<ReturnType<ReturnType<typeof setup>["run"]>>) =>
  o.status === "sent" ? o.messages : o.sent;

describe("operación de texto (un mensaje)", () => {
  it("conversación inexistente → not_found y no se envía", async () => {
    const t = setup({}, { context: null });
    expect(await t.run()).toMatchObject({ status: "not_found" });
    expect(t.sendText).not.toHaveBeenCalled();
  });

  it("canal inactivo → channel_inactive sin reservar ni enviar", async () => {
    const t = setup({}, { context: makeContext({ status: "disabled" }) });
    expect(await t.run()).toMatchObject({ status: "channel_inactive" });
    expect(t.rows).toHaveLength(0);
    expect(t.sendText).not.toHaveBeenCalled();
  });

  it("sin token → misconfigured sin reservar ni enviar", async () => {
    const t = setup({}, {}, false);
    expect(await t.run()).toMatchObject({ status: "misconfigured" });
    expect(t.rows).toHaveLength(0);
  });

  it("éxito: outbound/human/text/sent con wamid, sin media y con vista previa", async () => {
    const t = setup();
    const outcome = await t.run();
    expect(outcome.status).toBe("sent");
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "text",
      text: "Hola, ¿todo bien?",
      external_id: "wamid.T1",
      status: "sent",
      media: null,
      client_request_id: REQUEST_ID,
    });
    expect(t.touches.map((x) => x.preview)).toEqual(["Hola, ¿todo bien?"]);
  });

  it("el teléfono y el phone_number_id salen del servidor", async () => {
    const t = setup();
    await t.run();
    expect(t.sendText).toHaveBeenCalledWith({
      phoneNumberId: "1365004563368241",
      to: "+34600111222",
      text: "Hola, ¿todo bien?",
    });
  });

  it("doble envío con el mismo requestId: un solo WhatsApp", async () => {
    const t = setup();
    await t.run();
    const second = await t.run();
    expect(t.sendText).toHaveBeenCalledTimes(1);
    expect(t.rows).toHaveLength(1);
    expect(second).toMatchObject({ status: "sent", deduplicated: true });
  });

  it("peticiones simultáneas con el mismo requestId: un solo WhatsApp", async () => {
    const t = setup();
    const [a, b] = await Promise.all([t.run(), t.run()]);
    expect(t.sendText).toHaveBeenCalledTimes(1);
    expect([a.status, b.status].sort()).toEqual(["in_progress", "sent"]);
  });

  it("rechazo 4xx: failed, y el reintento reutiliza la misma fila", async () => {
    let calls = 0;
    const t = setup({
      text: async () => (++calls === 1 ? { status: "rejected", reason: "other" } : { status: "sent", wamid: "wamid.OK" }),
    });
    expect(await t.run()).toMatchObject({ status: "rejected", reason: "other" });
    expect(t.rows[0]!.status).toBe("failed");
    expect(t.touches).toHaveLength(0);

    expect((await t.run()).status).toBe("sent");
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ status: "sent", external_id: "wamid.OK" });
  });

  it("resultado incierto: queda pending y el reintento NO reenvía", async () => {
    const t = setup({ text: async () => ({ status: "unconfirmed" }) });
    expect(await t.run()).toMatchObject({ status: "unconfirmed" });
    expect(await t.run()).toMatchObject({ status: "in_progress" });
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });

  it("Meta acepta pero falla guardar: no hay segundo envío al reintentar", async () => {
    const t = setup({}, { markSentFailures: 99 });
    const logger = { error: vi.fn() };
    const outcome = await sendConversationOperation(
      { conversationId: CONVERSATION_ID, requestId: REQUEST_ID, text: "secreto-texto" },
      {
        repository: t.repo,
        sendText: t.sendText,
        uploadMedia: t.uploadMedia,
        sendDocument: t.sendDocument,
        isConfigured: () => true,
        logger,
      }
    );
    expect(outcome).toMatchObject({ status: "sent_not_saved" });
    const logged = logger.error.mock.calls[0]![0] as string;
    expect(logged).toContain("wamid.T1");
    expect(logged).not.toContain("secreto-texto");
    expect(logged).not.toContain("+34600111222");

    expect(await t.run({ text: "secreto-texto" })).toMatchObject({ status: "in_progress" });
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });

  it("el mismo requestId con otro texto → request_conflict", async () => {
    const t = setup();
    await t.run();
    expect(await t.run({ text: "otro texto" })).toMatchObject({ status: "request_conflict" });
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });
});

describe("operación de texto largo (varios mensajes)", () => {
  const long = Array.from({ length: 9500 / 100 }, (_, i) => `Párrafo ${i} ${"x".repeat(80)}`).join("\n\n");

  it("9.500 caracteres se envían en orden como varios mensajes ≤ 4096", async () => {
    const t = setup();
    const outcome = await t.run({ text: long });
    expect(outcome.status).toBe("sent");

    const bodies = t.sendText.mock.calls.map((c) => c[0].text);
    expect(bodies.length).toBeGreaterThanOrEqual(3);
    expect(bodies.every((b) => Array.from(b).length <= 4096)).toBe(true);
    expect(bodies.join("")).toBe(long);
    expect(t.rows.map((r) => r.text)).toEqual(bodies);
  });

  it("cada trozo tiene su propio id y los mensajes quedan en orden cronológico", async () => {
    const t = setup();
    await t.run({ text: long });
    const ids = t.rows.map((r) => r.client_request_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(REQUEST_ID);
    const times = t.rows.map((r) => Date.parse(r.provider_timestamp));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it("retry de la misma operación NO reenvía los trozos ya enviados", async () => {
    const t = setup();
    await t.run({ text: long });
    const calls = t.sendText.mock.calls.length;

    const again = await t.run({ text: long });
    expect(again).toMatchObject({ status: "sent", deduplicated: true });
    expect(t.sendText).toHaveBeenCalledTimes(calls);
    expect(t.rows).toHaveLength(calls);
  });

  it("trozo 3 incierto: el retry no reenvía el 1 ni el 2, ni el 3", async () => {
    let n = 0;
    const t = setup({
      text: async () => (++n === 3 ? { status: "unconfirmed" } : { status: "sent", wamid: `wamid.${n}` }),
    });

    const first = await t.run({ text: long });
    expect(first).toMatchObject({ status: "unconfirmed" });
    expect(sentMessages(first)).toHaveLength(2);
    expect(t.sendText).toHaveBeenCalledTimes(3);

    const retry = await t.run({ text: long });
    expect(retry).toMatchObject({ status: "in_progress" });
    expect(sentMessages(retry)).toHaveLength(2);
    // Ni se reenviaron 1 y 2 ni se repitió el 3.
    expect(t.sendText).toHaveBeenCalledTimes(3);
    expect(t.rows.map((r) => r.status)).toEqual(["sent", "sent", "pending"]);
  });

  it("trozo 3 rechazado (4xx): el retry solo reintenta el 3 y sigue con los demás", async () => {
    let n = 0;
    const t = setup({
      text: async () => (++n === 3 ? { status: "rejected", reason: "other" } : { status: "sent", wamid: `wamid.${n}` }),
    });
    const first = await t.run({ text: long });
    expect(first).toMatchObject({ status: "rejected" });
    expect(t.rows.map((r) => r.status)).toEqual(["sent", "sent", "failed"]);

    const retry = await t.run({ text: long });
    expect(retry.status).toBe("sent");
    const expected = splitText(long).length;
    // 3 intentos del primer pase + 1 reintento del 3 + los restantes.
    expect(t.sendText).toHaveBeenCalledTimes(3 + (expected - 2));
    expect(t.rows).toHaveLength(expected);
    expect(t.rows.every((r) => r.status === "sent")).toBe(true);
  });
});

describe("operación con documento generado en servidor", () => {
  it("genera, sube a Meta como PDF, envía con el media_id y persiste document/sent con metadatos seguros", async () => {
    const t = setup();
    const document = makeDocument();
    const outcome = await t.run({ document });
    expect(outcome.status).toBe("sent");

    expect(t.uploadMedia).toHaveBeenCalledWith({
      phoneNumberId: "1365004563368241",
      bytes: PDF,
      mimeType: "application/pdf",
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
    });
    expect(t.sendDocument).toHaveBeenCalledWith({
      phoneNumberId: "1365004563368241",
      to: "+34600111222",
      mediaId: "MEDIA-1",
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
      caption: null,
    });
    expect(t.sendText).not.toHaveBeenCalled();

    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "document",
      text: null,
      external_id: "wamid.DOC",
      status: "sent",
      client_request_id: REQUEST_ID,
      media: {
        mime_type: "application/pdf",
        filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
        size: PDF.length,
        provider_media_id: "MEDIA-1",
        source: "nexo_report",
        report_type: "monthly",
        restaurant_id: 123,
        period: "2026-09",
      },
    });
    expect(t.touches.map((x) => x.preview)).toEqual(["📊 Informe mensual · BK Zizur"]);
  });

  it("la media persistida no contiene token, URL ni bytes", async () => {
    const t = setup();
    await t.run({ document: makeDocument() });
    expect(JSON.stringify(t.rows[0]!.media)).not.toMatch(/token|http|bytes|raw/i);
  });

  it("doble requestId: no se genera, no se sube y no se envía dos veces", async () => {
    const t = setup();
    const document = makeDocument();
    await t.run({ document });
    const second = await t.run({ document });
    expect(second).toMatchObject({ status: "sent", deduplicated: true });
    expect(document.produce).toHaveBeenCalledTimes(1);
    expect(t.uploadMedia).toHaveBeenCalledTimes(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
    expect(t.rows).toHaveLength(1);
  });

  it("Meta acepta pero falla guardar: el reintento no genera, no sube y no envía", async () => {
    const t = setup({}, { markSentFailures: 99 });
    const document = makeDocument();
    expect(await t.run({ document })).toMatchObject({ status: "sent_not_saved" });
    expect(await t.run({ document })).toMatchObject({ status: "in_progress" });
    expect(document.produce).toHaveBeenCalledTimes(1);
    expect(t.uploadMedia).toHaveBeenCalledTimes(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("un fallo puntual al guardar se reintenta sin volver a llamar a Meta", async () => {
    const t = setup({}, { markSentFailures: 1 });
    expect((await t.run({ document: makeDocument() })).status).toBe("sent");
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("fallo al generar el PDF: no se sube ni se envía nada, queda failed y se puede reintentar", async () => {
    const t = setup();
    const document = makeDocument();
    document.produce.mockRejectedValueOnce(new Error("chromium"));
    expect(await t.run({ document })).toMatchObject({ status: "generation_failed" });
    expect(t.uploadMedia).not.toHaveBeenCalled();
    expect(t.rows[0]!.status).toBe("failed");

    expect((await t.run({ document })).status).toBe("sent");
    expect(t.rows).toHaveLength(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("fallo de subida: no se envía nada, queda failed y se puede reintentar", async () => {
    let n = 0;
    const t = setup({
      upload: async () => (++n === 1 ? { status: "failed" } : { status: "uploaded", mediaId: "MEDIA-2" }),
    });
    expect(await t.run({ document: makeDocument() })).toMatchObject({ status: "upload_failed" });
    expect(t.sendDocument).not.toHaveBeenCalled();
    expect((await t.run({ document: makeDocument() })).status).toBe("sent");
    expect(t.rows).toHaveLength(1);
  });

  it("envío incierto tras subir: pending y el reintento no genera, no sube y no envía otra vez", async () => {
    const t = setup({ media: async () => ({ status: "unconfirmed" }) });
    const document = makeDocument();
    expect(await t.run({ document })).toMatchObject({ status: "unconfirmed" });
    expect(await t.run({ document })).toMatchObject({ status: "in_progress" });
    expect(document.produce).toHaveBeenCalledTimes(1);
    expect(t.uploadMedia).toHaveBeenCalledTimes(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("el mismo requestId con otro informe → request_conflict sin generar", async () => {
    const t = setup();
    await t.run({ document: makeDocument() });
    const other = makeDocument({ media: { ...makeDocument().media, restaurant_id: 999 } });
    expect(await t.run({ document: other })).toMatchObject({ status: "request_conflict" });
    expect(other.produce).not.toHaveBeenCalled();
  });
});

describe("parseSendFields", () => {
  it("recorta el texto y acepta un requestId UUID", () => {
    expect(parseSendFields({ text: "  hola  ", requestId: REQUEST_ID })).toEqual({
      ok: true,
      text: "hola",
      requestId: REQUEST_ID,
    });
  });

  it("rechaza texto vacío, requestId inválido y tipos incorrectos", () => {
    expect(parseSendFields({ text: "   ", requestId: REQUEST_ID }).ok).toBe(false);
    expect(parseSendFields({ text: "hola", requestId: "x" }).ok).toBe(false);
    expect(parseSendFields({ text: 5, requestId: REQUEST_ID }).ok).toBe(false);
    expect(parseSendFields(null).ok).toBe(false);
  });

  it("límite interno de 20.000 caracteres (4.097 sí, 20.001 no)", () => {
    expect(parseSendFields({ text: "a".repeat(4097), requestId: REQUEST_ID }).ok).toBe(true);
    expect(parseSendFields({ text: "a".repeat(20_000), requestId: REQUEST_ID }).ok).toBe(true);
    expect(parseSendFields({ text: "a".repeat(20_001), requestId: REQUEST_ID }).ok).toBe(false);
  });

  it("ignora teléfono, canal y sender enviados por el navegador", () => {
    const parsed = parseSendFields({
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
