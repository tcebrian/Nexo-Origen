import { describe, expect, it } from "vitest";
import { parseWhatsAppWebhook } from "./parse-webhook";

// Todos los datos son inventados.
const CHANNEL = "100000000000001";
const SENDER_WA_ID = "34600000001";
const SENDER_E164 = "+34600000001";
const TS = "1760000000";
const TS_DATE = new Date(1760000000 * 1000);

type Obj = Record<string, unknown>;

function value(extra: Obj = {}, channel: string | null = CHANNEL): Obj {
  return {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "34600000099", phone_number_id: channel },
    ...extra,
  };
}

function webhook(...values: Obj[]): Obj {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "200000000000001",
        changes: values.map((v) => ({ field: "messages", value: v })),
      },
    ],
  };
}

function msg(extra: Obj, id = "wamid.TEST1"): Obj {
  return { from: SENDER_WA_ID, id, timestamp: TS, ...extra };
}

function parseOne(message: Obj) {
  return parseWhatsAppWebhook(webhook(value({ messages: [message] })));
}

describe("parseWhatsAppWebhook — mensajes", () => {
  it("1. mensaje de texto", () => {
    const { messages, statuses } = parseOne(msg({ type: "text", text: { body: "Hola" } }));
    expect(statuses).toEqual([]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      externalMessageId: "wamid.TEST1",
      channelExternalId: CHANNEL,
      senderPhone: SENDER_E164,
      contentType: "text",
      text: "Hola",
      providerTimestamp: TS_DATE,
    });
    expect(messages[0].media).toBeUndefined();
  });

  it("2. audio / nota de voz", () => {
    const { messages } = parseOne(
      msg({ type: "audio", audio: { id: "media-a1", mime_type: "audio/ogg; codecs=opus", voice: true } })
    );
    expect(messages[0].contentType).toBe("audio");
    expect(messages[0].media).toEqual({
      externalMediaId: "media-a1",
      mimeType: "audio/ogg; codecs=opus",
      isVoiceMessage: true,
    });
    expect(messages[0].text).toBeUndefined();
  });

  it("2b. audio que no es nota de voz no marca isVoiceMessage", () => {
    const { messages } = parseOne(
      msg({ type: "audio", audio: { id: "media-a2", mime_type: "audio/mpeg" } })
    );
    expect(messages[0].media).toEqual({ externalMediaId: "media-a2", mimeType: "audio/mpeg" });
  });

  it("2c. sin indicador explícito de voz no se deduce por mime type ni formato", () => {
    for (const voice of [undefined, false, "true", 1, null]) {
      const { messages } = parseOne(
        msg({ type: "audio", audio: { id: "media-a3", mime_type: "audio/ogg; codecs=opus", voice } })
      );
      expect(messages[0].contentType).toBe("audio");
      expect(messages[0].media?.isVoiceMessage).toBeUndefined();
    }
  });

  it("3. imagen con caption", () => {
    const { messages } = parseOne(
      msg({ type: "image", image: { id: "media-i1", mime_type: "image/jpeg", sha256: "x", caption: "Mira" } })
    );
    expect(messages[0].contentType).toBe("image");
    expect(messages[0].media).toEqual({
      externalMediaId: "media-i1",
      mimeType: "image/jpeg",
      caption: "Mira",
    });
    expect(messages[0].text).toBeUndefined();
  });

  it("4. vídeo", () => {
    const { messages } = parseOne(
      msg({ type: "video", video: { id: "media-v1", mime_type: "video/mp4" } })
    );
    expect(messages[0].contentType).toBe("video");
    expect(messages[0].media).toEqual({ externalMediaId: "media-v1", mimeType: "video/mp4" });
  });

  it("5. documento con filename", () => {
    const { messages } = parseOne(
      msg({
        type: "document",
        document: { id: "media-d1", mime_type: "application/pdf", filename: "carta.pdf", caption: "Carta" },
      })
    );
    expect(messages[0].contentType).toBe("document");
    expect(messages[0].media).toEqual({
      externalMediaId: "media-d1",
      mimeType: "application/pdf",
      filename: "carta.pdf",
      caption: "Carta",
    });
  });

  it("6. sticker", () => {
    const { messages } = parseOne(
      msg({ type: "sticker", sticker: { id: "media-s1", mime_type: "image/webp", animated: false } })
    );
    expect(messages[0].contentType).toBe("sticker");
    expect(messages[0].media).toEqual({ externalMediaId: "media-s1", mimeType: "image/webp" });
  });

  it("7. tipos no soportados → unsupported sin media", () => {
    for (const extra of [
      { type: "reaction", reaction: { message_id: "wamid.X", emoji: "👍" } },
      { type: "location", location: { latitude: 1, longitude: 2 } },
      { type: "contacts", contacts: [{ name: { formatted_name: "Ana" } }] },
      { type: "interactive", interactive: { type: "button_reply" } },
      { type: "tipo_futuro_desconocido" },
    ]) {
      const { messages } = parseOne(msg(extra));
      expect(messages).toHaveLength(1);
      expect(messages[0].contentType).toBe("unsupported");
      expect(messages[0].text).toBeUndefined();
      expect(messages[0].media).toBeUndefined();
      expect(messages[0].externalMessageId).toBe("wamid.TEST1");
    }
  });

  it("7b. tipo conocido pero sin datos suficientes → unsupported", () => {
    const noBody = parseOne(msg({ type: "text", text: {} })).messages[0];
    const noId = parseOne(msg({ type: "image", image: { mime_type: "image/png" } })).messages[0];
    const noMime = parseOne(msg({ type: "audio", audio: { id: "m" } })).messages[0];
    for (const m of [noBody, noId, noMime]) {
      expect(m.contentType).toBe("unsupported");
      expect(m.media).toBeUndefined();
    }
  });

  it("10. múltiples mensajes en un mismo value", () => {
    const { messages } = parseWhatsAppWebhook(
      webhook(
        value({
          messages: [
            msg({ type: "text", text: { body: "uno" } }, "wamid.A"),
            msg({ type: "text", text: { body: "dos" } }, "wamid.B"),
          ],
        })
      )
    );
    expect(messages.map((m) => [m.externalMessageId, m.text])).toEqual([
      ["wamid.A", "uno"],
      ["wamid.B", "dos"],
    ]);
  });

  it("11. múltiples entry y change", () => {
    const otherChannel = "100000000000002";
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "e1",
          changes: [
            { field: "messages", value: value({ messages: [msg({ type: "text", text: { body: "a" } }, "wamid.1")] }) },
            { field: "otro_campo", value: value({ messages: [msg({ type: "text", text: { body: "ignorado" } }, "wamid.X")] }) },
          ],
        },
        {
          id: "e2",
          changes: [
            { field: "messages", value: value({ messages: [msg({ type: "text", text: { body: "b" } }, "wamid.2")] }, otherChannel) },
          ],
        },
      ],
    };
    const { messages } = parseWhatsAppWebhook(payload);
    expect(messages.map((m) => [m.externalMessageId, m.channelExternalId])).toEqual([
      ["wamid.1", CHANNEL],
      ["wamid.2", otherChannel],
    ]);
  });

  it("12. contacto y profile name relacionados por wa_id, no por posición", () => {
    const other = "34600000002";
    const { messages } = parseWhatsAppWebhook(
      webhook(
        value({
          contacts: [
            { wa_id: other, profile: { name: "Berta" } },
            { wa_id: SENDER_WA_ID, profile: { name: "Ana" } },
          ],
          messages: [
            msg({ type: "text", text: { body: "x" } }, "wamid.A"),
            { ...msg({ type: "text", text: { body: "y" } }, "wamid.B"), from: other },
            { ...msg({ type: "text", text: { body: "z" } }, "wamid.C"), from: "34600000003" },
          ],
        })
      )
    );
    expect(messages.map((m) => m.senderProfileName)).toEqual(["Ana", "Berta", undefined]);
  });

  it("12b. sin contacts no hay profile name", () => {
    const { messages } = parseOne(msg({ type: "text", text: { body: "x" } }));
    expect(messages[0].senderProfileName).toBeUndefined();
  });

  it("raw guarda solo el fragmento del mensaje, no el webhook entero", () => {
    const original = msg({ type: "text", text: { body: "Hola" } });
    const { messages } = parseOne(original);
    expect(messages[0].raw).toEqual(original);
    expect(JSON.stringify(messages[0].raw)).not.toContain("whatsapp_business_account");
  });

  it("13. timestamp correcto", () => {
    const { messages } = parseOne(msg({ type: "text", text: { body: "x" }, timestamp: "1700000000" }));
    expect(messages[0].providerTimestamp).toEqual(new Date("2023-11-14T22:13:20.000Z"));
  });

  it("14. timestamp inválido o ausente → mensaje omitido (sin inventar now())", () => {
    for (const timestamp of ["", "abc", "-5", "0", "12.5", null, undefined, {}, "999999999999999"]) {
      const { messages } = parseOne({ ...msg({ type: "text", text: { body: "x" } }), timestamp });
      expect(messages).toEqual([]);
    }
  });

  it("omite mensajes sin id o con remitente inválido", () => {
    expect(parseOne({ ...msg({ type: "text", text: { body: "x" } }), id: undefined }).messages).toEqual([]);
    expect(parseOne({ ...msg({ type: "text", text: { body: "x" } }), from: "abc" }).messages).toEqual([]);
    expect(parseOne({ ...msg({ type: "text", text: { body: "x" } }), from: undefined }).messages).toEqual([]);
  });

  it("20. un mensaje malformado no rompe los demás", () => {
    const { messages } = parseWhatsAppWebhook(
      webhook(
        value({
          messages: [
            msg({ type: "text", text: { body: "ok1" } }, "wamid.A"),
            null,
            "texto suelto",
            42,
            { id: "sin-from" },
            msg({ type: "text", text: { body: "sin ts" }, timestamp: "xx" }, "wamid.B"),
            msg({ type: "text", text: { body: "ok2" } }, "wamid.C"),
          ],
        })
      )
    );
    expect(messages.map((m) => m.externalMessageId)).toEqual(["wamid.A", "wamid.C"]);
  });

  it("omite el value completo si no hay phone_number_id", () => {
    const { messages } = parseWhatsAppWebhook(
      webhook(value({ messages: [msg({ type: "text", text: { body: "x" } })] }, null))
    );
    expect(messages).toEqual([]);
  });
});

describe("parseWhatsAppWebhook — robustez", () => {
  const empty = { messages: [], statuses: [] };

  it("8. payload sin messages ni statuses", () => {
    expect(parseWhatsAppWebhook(webhook(value()))).toEqual(empty);
    expect(parseWhatsAppWebhook(webhook(value({ messages: "no-es-array", statuses: {} })))).toEqual(empty);
  });

  it("9. payload completamente inválido", () => {
    for (const payload of [undefined, null, 42, "texto", [], {}, true, () => 1]) {
      expect(parseWhatsAppWebhook(payload)).toEqual(empty);
    }
  });

  it("object distinto de whatsapp_business_account", () => {
    const payload = { ...webhook(value({ messages: [msg({ type: "text", text: { body: "x" } })] })), object: "page" };
    expect(parseWhatsAppWebhook(payload)).toEqual(empty);
  });

  it("entry, changes o value inexistentes o con forma inesperada", () => {
    for (const payload of [
      { object: "whatsapp_business_account" },
      { object: "whatsapp_business_account", entry: "x" },
      { object: "whatsapp_business_account", entry: [null, 1, {}] },
      { object: "whatsapp_business_account", entry: [{ changes: [null, {}, { field: "messages" }] }] },
      { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: [] }] }] },
    ]) {
      expect(parseWhatsAppWebhook(payload)).toEqual(empty);
    }
  });

  it("no lanza con getters hostiles", () => {
    const hostile = {
      object: "whatsapp_business_account",
      get entry(): unknown {
        throw new Error("boom");
      },
    };
    expect(() => parseWhatsAppWebhook(hostile)).not.toThrow();
    expect(parseWhatsAppWebhook(hostile)).toEqual(empty);
  });

  it("una entrada con getter hostil no impide procesar el resto", () => {
    const hostileMessage = {
      get id(): unknown {
        throw new Error("boom");
      },
    };
    const { messages } = parseWhatsAppWebhook(
      webhook(value({ messages: [hostileMessage, msg({ type: "text", text: { body: "ok" } }, "wamid.OK")] }))
    );
    expect(messages.map((m) => m.externalMessageId)).toEqual(["wamid.OK"]);
  });
});

describe("parseWhatsAppWebhook — statuses", () => {
  function status(extra: Obj = {}): Obj {
    return { id: "wamid.OUT1", status: "sent", timestamp: TS, recipient_id: SENDER_WA_ID, ...extra };
  }
  function parseStatuses(...statuses: Obj[]) {
    return parseWhatsAppWebhook(webhook(value({ statuses })));
  }

  it("15–17. sent, delivered y read", () => {
    for (const s of ["sent", "delivered", "read"] as const) {
      const { statuses, messages } = parseStatuses(status({ status: s }));
      expect(messages).toEqual([]);
      expect(statuses).toEqual([
        {
          externalMessageId: "wamid.OUT1",
          externalChannelId: CHANNEL,
          recipientPhone: SENDER_E164,
          status: s,
          providerTimestamp: TS_DATE,
        },
      ]);
    }
  });

  it("18. failed con error normalizado", () => {
    const { statuses } = parseStatuses(
      status({
        status: "failed",
        errors: [{ code: 131047, title: "Re-engagement message", message: "Fuera de ventana", error_data: { details: "detalle" } }],
      })
    );
    expect(statuses[0].status).toBe("failed");
    expect(statuses[0].error).toEqual({ code: "131047", message: "Fuera de ventana" });
  });

  it("18b. failed usa title o details si no hay message, y funciona sin errors", () => {
    const withTitle = parseStatuses(status({ status: "failed", errors: [{ code: 1, title: "Titulo" }] }));
    expect(withTitle.statuses[0].error).toEqual({ code: "1", message: "Titulo" });

    const withDetails = parseStatuses(status({ status: "failed", errors: [{ error_data: { details: "solo detalle" } }] }));
    expect(withDetails.statuses[0].error).toEqual({ message: "solo detalle" });

    const none = parseStatuses(status({ status: "failed" }));
    expect(none.statuses[0].status).toBe("failed");
    expect(none.statuses[0].error).toBeUndefined();
  });

  it("no añade error a estados que no son failed", () => {
    const { statuses } = parseStatuses(status({ status: "sent", errors: [{ code: 1, message: "x" }] }));
    expect(statuses[0].error).toBeUndefined();
  });

  it("deleted se conserva como estado", () => {
    const { statuses } = parseStatuses(status({ status: "deleted" }));
    expect(statuses).toEqual([
      {
        externalMessageId: "wamid.OUT1",
        externalChannelId: CHANNEL,
        recipientPhone: SENDER_E164,
        status: "deleted",
        providerTimestamp: TS_DATE,
      },
    ]);
  });

  it("deleted no lleva error aunque el payload incluya errors", () => {
    const { statuses } = parseStatuses(status({ status: "deleted", errors: [{ code: 1, message: "x" }] }));
    expect(statuses[0].error).toBeUndefined();
  });

  it("19. status desconocido o ausente se omite", () => {
    expect(parseStatuses(status({ status: "inventado" })).statuses).toEqual([]);
    expect(parseStatuses(status({ status: undefined })).statuses).toEqual([]);
  });

  it("omite statuses sin id, destinatario o timestamp válidos, sin afectar al resto", () => {
    const { statuses } = parseStatuses(
      status({ id: undefined }),
      status({ recipient_id: "abc" }),
      status({ timestamp: "x" }),
      null as unknown as Obj,
      status({ id: "wamid.OK", status: "read" })
    );
    expect(statuses.map((s) => s.externalMessageId)).toEqual(["wamid.OK"]);
  });

  it("mensajes y statuses en el mismo webhook", () => {
    const { messages, statuses } = parseWhatsAppWebhook(
      webhook(
        value({
          messages: [msg({ type: "text", text: { body: "hola" } })],
          statuses: [status({ status: "delivered" })],
        })
      )
    );
    expect(messages).toHaveLength(1);
    expect(statuses).toHaveLength(1);
  });
});
