import { describe, expect, it } from "vitest";
import {
  ingestInboundMessage,
  type InboundConversationRepository,
} from "./ingest-inbound";
import type { InboundMessage } from "./types";

const message: InboundMessage = {
  externalMessageId: "wamid.TEST1",
  channelExternalId: "100000000000001",
  senderPhone: "+34600000001",
  senderProfileName: "JR 🍔",
  contentType: "text",
  text: "¿Cómo vamos hoy?",
  providerTimestamp: new Date("2025-10-09T10:05:00.000Z"),
  raw: { from: "34600000001", id: "wamid.TEST1", dato: "personal" },
};

type Call = { op: string; input: unknown };

/** Repositorio falso: registra las llamadas en orden y permite cambiar respuestas. */
function fakeRepository(overrides: Partial<InboundConversationRepository> = {}) {
  const calls: Call[] = [];
  const record =
    <I, O>(op: string, result: O) =>
    async (input: I): Promise<O> => {
      calls.push({ op, input });
      return result;
    };

  const repository: InboundConversationRepository = {
    resolveChannel: async (provider, externalAccountId) => {
      calls.push({ op: "resolveChannel", input: { provider, externalAccountId } });
      return { status: "found", channel: { id: "canal-1", empresaId: 7 } };
    },
    findOrCreateContact: record("findOrCreateContact", { contact: { id: "contacto-1" }, created: false }),
    findOrCreateConversation: record("findOrCreateConversation", {
      conversation: { id: "conv-1" },
      created: false,
    }),
    insertInboundMessage: record("insertInboundMessage", { status: "inserted" as const }),
    touchConversationLastMessage: record("touchConversationLastMessage", true),
    ...overrides,
  };
  return { repository, calls, ops: () => calls.map((c) => c.op) };
}

const call = (calls: Call[], op: string) => calls.find((c) => c.op === op)?.input as Record<string, unknown>;

describe("ingestInboundMessage — canal", () => {
  it("1. canal encontrado → flujo completo en orden", async () => {
    const { repository, ops } = fakeRepository();
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);

    expect(ops()).toEqual([
      "resolveChannel",
      "findOrCreateContact",
      "findOrCreateConversation",
      "insertInboundMessage",
      "touchConversationLastMessage",
    ]);
    expect(result).toEqual({
      status: "stored",
      empresaId: 7,
      channelId: "canal-1",
      contactId: "contacto-1",
      conversationId: "conv-1",
      contactCreated: false,
      conversationCreated: false,
      lastMessageUpdated: true,
    });
  });

  it("resuelve el canal con el proveedor y el id externo del mensaje", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(call(calls, "resolveChannel")).toEqual({
      provider: "whatsapp_cloud",
      externalAccountId: "100000000000001",
    });
  });

  it("2. canal no encontrado → se detiene sin más operaciones", async () => {
    const { repository, ops } = fakeRepository({
      resolveChannel: async () => ({ status: "not_found" }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toEqual({ status: "channel_not_found" });
    expect(ops()).toEqual([]);
  });

  it("3. canal inactivo → se detiene sin crear contacto, conversación ni mensaje", async () => {
    const { repository, ops } = fakeRepository({
      resolveChannel: async () => ({ status: "inactive", channel: { id: "canal-9", empresaId: 7 } }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toEqual({ status: "channel_inactive", channelId: "canal-9" });
    expect(ops()).toEqual([]);
  });
});

describe("ingestInboundMessage — contacto y conversación", () => {
  it("4 y 5. contacto existente o nuevo se refleja en el resultado", async () => {
    for (const created of [false, true]) {
      const { repository } = fakeRepository({
        findOrCreateContact: async () => ({ contact: { id: "contacto-1" }, created }),
      });
      const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
      expect(result).toMatchObject({ status: "stored", contactCreated: created });
    }
  });

  it("6 y 7. conversación existente o nueva se refleja en el resultado", async () => {
    for (const created of [false, true]) {
      const { repository } = fakeRepository({
        findOrCreateConversation: async () => ({ conversation: { id: "conv-1" }, created }),
      });
      const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
      expect(result).toMatchObject({ status: "stored", conversationCreated: created });
    }
  });

  it("pasa teléfono y nombre de perfil al contacto, y encadena los ids", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);

    expect(call(calls, "findOrCreateContact")).toEqual({
      empresaId: 7,
      telefonoE164: "+34600000001",
      profileName: "JR 🍔",
    });
    expect(call(calls, "findOrCreateConversation")).toEqual({
      empresaId: 7,
      canalId: "canal-1",
      contactoId: "contacto-1",
    });
    expect(call(calls, "insertInboundMessage")).toMatchObject({
      empresaId: 7,
      canalId: "canal-1",
      conversacionId: "conv-1",
    });
  });

  it("nunca se pasa un `nombre` manual al contacto", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect("nombre" in call(calls, "findOrCreateContact")).toBe(false);
  });

  it("13. la empresa sale del canal en todas las operaciones", async () => {
    const { repository, calls } = fakeRepository({
      resolveChannel: async () => ({ status: "found", channel: { id: "canal-X", empresaId: 42 } }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);

    for (const op of [
      "findOrCreateContact",
      "findOrCreateConversation",
      "insertInboundMessage",
      "touchConversationLastMessage",
    ]) {
      expect(call(calls, op).empresaId).toBe(42);
    }
    expect(result).toMatchObject({ empresaId: 42, channelId: "canal-X" });
  });
});

describe("ingestInboundMessage — mensaje y último mensaje", () => {
  it("8. mensaje inserted → stored", async () => {
    const { repository } = fakeRepository();
    expect(await ingestInboundMessage(repository, "whatsapp_cloud", message)).toMatchObject({
      status: "stored",
    });
  });

  it("9. mensaje duplicate → resultado normal, no excepción", async () => {
    const { repository } = fakeRepository({
      insertInboundMessage: async () => ({ status: "duplicate" }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toMatchObject({ status: "duplicate", conversationId: "conv-1" });
  });

  it("10. un duplicado también intenta actualizar el último mensaje (reparación)", async () => {
    const { repository, calls, ops } = fakeRepository({
      insertInboundMessage: async () => ({ status: "duplicate" }),
    });
    await ingestInboundMessage(repository, "whatsapp_cloud", message);

    expect(ops().at(-1)).toBe("touchConversationLastMessage");
    expect(call(calls, "touchConversationLastMessage")).toEqual({
      conversacionId: "conv-1",
      empresaId: 7,
      lastMessageAt: message.providerTimestamp,
      preview: "¿Cómo vamos hoy?",
    });
  });

  it("usa el provider_timestamp del mensaje y informa si la conversación avanzó", async () => {
    const { repository } = fakeRepository({ touchConversationLastMessage: async () => false });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toMatchObject({ status: "stored", lastMessageUpdated: false });
  });

  it("el preview se calcula con el contenido del mensaje", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", {
      ...message,
      contentType: "audio",
      text: undefined,
      media: { externalMediaId: "m", mimeType: "audio/ogg", isVoiceMessage: true },
    });
    expect(call(calls, "touchConversationLastMessage").preview).toBe("🎤 Nota de voz");
  });

  it("11. raw no llega a la persistencia", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);

    const persisted = call(calls, "insertInboundMessage").message as InboundMessage;
    expect("raw" in persisted).toBe(false);
    expect(JSON.stringify(calls)).not.toContain("personal");
    expect(persisted.externalMessageId).toBe("wamid.TEST1");
    expect(message.raw).toBeDefined();
  });
});

describe("ingestInboundMessage — errores", () => {
  const boom = new Error("conversations.insertInboundMessage failed (08006)");

  it("12. un error real del repositorio se propaga", async () => {
    const failing = {
      resolveChannel: { resolveChannel: async () => Promise.reject(boom) },
      findOrCreateContact: { findOrCreateContact: async () => Promise.reject(boom) },
      findOrCreateConversation: { findOrCreateConversation: async () => Promise.reject(boom) },
      insertInboundMessage: { insertInboundMessage: async () => Promise.reject(boom) },
      touchConversationLastMessage: { touchConversationLastMessage: async () => Promise.reject(boom) },
    };
    for (const override of Object.values(failing)) {
      const { repository } = fakeRepository(override);
      await expect(ingestInboundMessage(repository, "whatsapp_cloud", message)).rejects.toBe(boom);
    }
  });

  it("si falla el insert no se actualiza el último mensaje (el reintento lo hará)", async () => {
    const { repository, ops } = fakeRepository({ insertInboundMessage: async () => Promise.reject(boom) });
    await expect(ingestInboundMessage(repository, "whatsapp_cloud", message)).rejects.toBe(boom);
    expect(ops()).not.toContain("touchConversationLastMessage");
  });

  it("reintento tras fallar a mitad: duplicate + actualización repara la conversación", async () => {
    // 1ª ejecución: el mensaje se guarda pero falla la actualización de la conversación.
    let stored = false;
    let lastMessageAt: Date | null = null;
    let failTouch = true;
    const { repository } = fakeRepository({
      insertInboundMessage: async () => {
        const status = stored ? "duplicate" : "inserted";
        stored = true;
        return { status };
      },
      touchConversationLastMessage: async ({ lastMessageAt: at }) => {
        if (failTouch) throw boom;
        if (lastMessageAt && lastMessageAt >= at) return false;
        lastMessageAt = at;
        return true;
      },
    });

    await expect(ingestInboundMessage(repository, "whatsapp_cloud", message)).rejects.toBe(boom);
    expect(stored).toBe(true);
    expect(lastMessageAt).toBeNull();

    failTouch = false;
    const retry = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(retry).toMatchObject({ status: "duplicate", lastMessageUpdated: true });
    expect(lastMessageAt).toEqual(message.providerTimestamp);
  });
});
