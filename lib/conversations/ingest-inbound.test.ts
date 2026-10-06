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
      return { status: "found", channel: { id: "canal-1" } };
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

/** Todas las claves (anidadas) de un valor, para vigilar que no aparezcan empresas ni permisos. */
function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, keys));
  else if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      allKeys(v, keys);
    }
  }
  return keys;
}
const TENANT_OR_PERMISSION = /empresa|restaurante|permiso|permission|todos_restaurantes|tenant/i;

describe("ingestInboundMessage — canal global", () => {
  it("1. canal global (sin empresa) → flujo completo en orden", async () => {
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
      channelId: "canal-1",
      contactId: "contacto-1",
      conversationId: "conv-1",
      contactCreated: false,
      conversationCreated: false,
      lastMessageUpdated: true,
    });
  });

  it("resuelve el canal solo con el proveedor y el id externo del mensaje", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(call(calls, "resolveChannel")).toEqual({
      provider: "whatsapp_cloud",
      externalAccountId: "100000000000001",
    });
  });

  it("11. canal no encontrado → se detiene sin más operaciones", async () => {
    const { repository, ops } = fakeRepository({
      resolveChannel: async () => ({ status: "not_found" }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toEqual({ status: "channel_not_found" });
    expect(ops()).toEqual([]);
  });

  it("11. canal inactivo → se detiene sin crear contacto, conversación ni mensaje", async () => {
    const { repository, ops } = fakeRepository({
      resolveChannel: async () => ({ status: "inactive", channel: { id: "canal-9" } }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toEqual({ status: "channel_inactive", channelId: "canal-9" });
    expect(ops()).toEqual([]);
  });
});

describe("ingestInboundMessage — contacto global y conversación", () => {
  it("2. el contacto se busca globalmente por teléfono (sin empresa) y recibe el nombre de perfil", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(call(calls, "findOrCreateContact")).toEqual({
      telefonoE164: "+34600000001",
      profileName: "JR 🍔",
    });
  });

  it("3. contacto nuevo SIN empresas ni restaurantes: se guarda y no se le da ningún permiso", async () => {
    const { repository, calls } = fakeRepository({
      findOrCreateContact: async () => ({ contact: { id: "desconocido-1" }, created: true }),
      findOrCreateConversation: async () => ({ conversation: { id: "conv-nueva" }, created: true }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toMatchObject({
      status: "stored",
      contactId: "desconocido-1",
      contactCreated: true,
      conversationCreated: true,
    });
    expect(allKeys(calls.map((c) => c.input)).has("nombre")).toBe(false);
    for (const key of allKeys(calls.map((c) => ({ ...(c.input as object), message: undefined })))) {
      expect(key).not.toMatch(TENANT_OR_PERMISSION);
    }
  });

  it("contacto existente se refleja en el resultado", async () => {
    const { repository } = fakeRepository({
      findOrCreateContact: async () => ({ contact: { id: "contacto-1" }, created: false }),
    });
    expect(await ingestInboundMessage(repository, "whatsapp_cloud", message)).toMatchObject({
      contactCreated: false,
    });
  });

  it("4. la conversación se busca por canal + contacto (sin empresa) y se encadenan los ids", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);

    expect(call(calls, "findOrCreateConversation")).toEqual({
      canalId: "canal-1",
      contactoId: "contacto-1",
    });
    expect(call(calls, "insertInboundMessage")).toMatchObject({
      canalId: "canal-1",
      conversacionId: "conv-1",
    });
    expect(call(calls, "touchConversationLastMessage")).toMatchObject({
      canalId: "canal-1",
      conversacionId: "conv-1",
    });
  });

  it("conversación existente o nueva se refleja en el resultado", async () => {
    for (const created of [false, true]) {
      const { repository } = fakeRepository({
        findOrCreateConversation: async () => ({ conversation: { id: "conv-1" }, created }),
      });
      expect(await ingestInboundMessage(repository, "whatsapp_cloud", message)).toMatchObject({
        conversationCreated: created,
      });
    }
  });

  it("9. ninguna operación de la ingesta toca empresas, restaurantes ni permisos", async () => {
    const { repository, calls, ops } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);

    // Solo existen estas 5 operaciones en el repositorio: ninguna es de permisos.
    expect(Object.keys(repository).sort()).toEqual([
      "findOrCreateContact",
      "findOrCreateConversation",
      "insertInboundMessage",
      "resolveChannel",
      "touchConversationLastMessage",
    ]);
    expect(ops().every((op) => !TENANT_OR_PERMISSION.test(op))).toBe(true);
    // Y ningún dato de entrada lleva claves de empresa/restaurante/permisos (salvo el mensaje del proveedor).
    for (const c of calls) {
      const input = { ...(c.input as object), message: undefined };
      for (const key of allKeys(input)) expect(key).not.toMatch(TENANT_OR_PERMISSION);
    }
  });

  it("10. el resultado ya no contiene empresaId ni nada de empresa/permisos", async () => {
    const { repository } = fakeRepository();
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect("empresaId" in result).toBe(false);
    for (const key of Object.keys(result)) expect(key).not.toMatch(TENANT_OR_PERMISSION);
  });
});

describe("ingestInboundMessage — mensaje y último mensaje", () => {
  it("5. el mensaje se guarda sin empresa_id", async () => {
    const { repository, calls } = fakeRepository();
    await ingestInboundMessage(repository, "whatsapp_cloud", message);
    const input = call(calls, "insertInboundMessage");
    expect(Object.keys(input).sort()).toEqual(["canalId", "conversacionId", "message"]);
  });

  it("mensaje inserted → stored", async () => {
    const { repository } = fakeRepository();
    expect(await ingestInboundMessage(repository, "whatsapp_cloud", message)).toMatchObject({
      status: "stored",
    });
  });

  it("6. mensaje duplicate → resultado normal, no excepción", async () => {
    const { repository } = fakeRepository({
      insertInboundMessage: async () => ({ status: "duplicate" }),
    });
    const result = await ingestInboundMessage(repository, "whatsapp_cloud", message);
    expect(result).toMatchObject({ status: "duplicate", conversationId: "conv-1" });
  });

  it("6. un duplicado también intenta actualizar el último mensaje (reparación)", async () => {
    const { repository, calls, ops } = fakeRepository({
      insertInboundMessage: async () => ({ status: "duplicate" }),
    });
    await ingestInboundMessage(repository, "whatsapp_cloud", message);

    expect(ops().at(-1)).toBe("touchConversationLastMessage");
    expect(call(calls, "touchConversationLastMessage")).toEqual({
      conversacionId: "conv-1",
      canalId: "canal-1",
      lastMessageAt: message.providerTimestamp,
      preview: "¿Cómo vamos hoy?",
    });
  });

  it("7. el último mensaje no retrocede: un mensaje tardío no hace avanzar la conversación", async () => {
    // Imita el UPDATE condicional del repositorio real (solo avanza si es estrictamente más reciente).
    let lastAt: Date | null = null;
    const touch: InboundConversationRepository["touchConversationLastMessage"] = async ({ lastMessageAt }) => {
      if (lastAt && lastAt >= lastMessageAt) return false;
      lastAt = lastMessageAt;
      return true;
    };
    const { repository } = fakeRepository({ touchConversationLastMessage: touch });
    const at = (hhmm: string) => new Date(`2025-10-09T${hhmm}:00.000Z`);

    const first = await ingestInboundMessage(repository, "whatsapp_cloud", { ...message, externalMessageId: "w.1", providerTimestamp: at("10:05") });
    const late = await ingestInboundMessage(repository, "whatsapp_cloud", { ...message, externalMessageId: "w.2", providerTimestamp: at("10:02") });
    const newer = await ingestInboundMessage(repository, "whatsapp_cloud", { ...message, externalMessageId: "w.3", providerTimestamp: at("10:07") });

    expect(first).toMatchObject({ status: "stored", lastMessageUpdated: true });
    expect(late).toMatchObject({ status: "stored", lastMessageUpdated: false });
    expect(newer).toMatchObject({ status: "stored", lastMessageUpdated: true });
    expect(lastAt).toEqual(at("10:07"));
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

  it("8. raw no llega a la persistencia", async () => {
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

  it("un error real del repositorio se propaga", async () => {
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
