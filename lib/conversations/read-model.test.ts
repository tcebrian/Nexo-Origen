import { describe, expect, it } from "vitest";
import {
  buildConversationList,
  buildMessageList,
  filterConversations,
  isValidConversationId,
  mapMessageRow,
  resolveContactDisplayName,
  type ConversationReadRow,
  type MessageReadRow,
} from "@/lib/conversations/read-model";

function conversationRow(over: Partial<ConversationReadRow> & { id: string }): ConversationReadRow {
  return {
    estado: "open",
    ultimo_mensaje_at: null,
    ultimo_mensaje_preview: null,
    conv_contactos: { telefono_e164: "+34600111222", nombre: null, nombre_perfil: null },
    ...over,
  };
}

function messageRow(over: Partial<MessageReadRow> & { id: string }): MessageReadRow {
  return {
    direction: "inbound",
    sender_type: "contact",
    content_type: "text",
    text: "hola",
    media: null,
    status: "received",
    provider_timestamp: "2026-10-01T10:00:00.000Z",
    received_at: null,
    ...over,
  };
}

describe("resolveContactDisplayName", () => {
  const phone = "+34600111222";

  it("prefiere el nombre interno", () => {
    expect(
      resolveContactDisplayName({ telefono_e164: phone, nombre: "Ana", nombre_perfil: "Ana WA" })
    ).toBe("Ana");
  });

  it("cae al nombre de perfil si no hay nombre", () => {
    expect(
      resolveContactDisplayName({ telefono_e164: phone, nombre: "  ", nombre_perfil: "Ana WA" })
    ).toBe("Ana WA");
  });

  it("cae al teléfono si no hay ninguno", () => {
    expect(resolveContactDisplayName({ telefono_e164: phone, nombre: null, nombre_perfil: null })).toBe(
      phone
    );
  });
});

describe("buildConversationList", () => {
  it("ordena por último mensaje descendente y deja las vacías al final", () => {
    const list = buildConversationList([
      conversationRow({ id: "a", ultimo_mensaje_at: "2026-10-01T10:00:00Z" }),
      conversationRow({ id: "b", ultimo_mensaje_at: null }),
      conversationRow({ id: "c", ultimo_mensaje_at: "2026-10-03T10:00:00Z" }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("acepta el embed como objeto o como lista y descarta filas sin contacto", () => {
    const list = buildConversationList([
      conversationRow({ id: "a" }),
      conversationRow({
        id: "b",
        conv_contactos: [{ telefono_e164: "+34600999888", nombre: "Luis", nombre_perfil: null }],
      }),
      conversationRow({ id: "c", conv_contactos: null }),
    ]);
    expect(list.map((c) => c.id).sort()).toEqual(["a", "b"]);
    expect(list.find((c) => c.id === "b")?.displayName).toBe("Luis");
  });

  it("no expone campos internos del contacto ni de la fila", () => {
    const [item] = buildConversationList([
      conversationRow({ id: "a", estado: "closed", ultimo_mensaje_preview: "  hola " }),
    ]);
    expect(Object.keys(item!).sort()).toEqual(
      ["displayName", "id", "lastMessageAt", "lastMessagePreview", "phone", "profileName", "status"].sort()
    );
    expect(item!.status).toBe("closed");
    expect(item!.lastMessagePreview).toBe("hola");
  });
});

describe("filterConversations", () => {
  const items = buildConversationList([
    conversationRow({
      id: "1",
      conv_contactos: { telefono_e164: "+34600111222", nombre: "María José", nombre_perfil: "Mari" },
    }),
    conversationRow({
      id: "2",
      conv_contactos: { telefono_e164: "+34700333444", nombre: null, nombre_perfil: "Carlos Bar" },
    }),
  ]);

  it("busca por nombre sin distinguir mayúsculas ni acentos", () => {
    expect(filterConversations(items, "maria jose").map((c) => c.id)).toEqual(["1"]);
  });

  it("busca por nombre de perfil", () => {
    expect(filterConversations(items, "bar").map((c) => c.id)).toEqual(["2"]);
  });

  it("busca por teléfono con o sin formato", () => {
    expect(filterConversations(items, "+34 700 333").map((c) => c.id)).toEqual(["2"]);
    expect(filterConversations(items, "600111").map((c) => c.id)).toEqual(["1"]);
  });

  it("una búsqueda vacía devuelve todo", () => {
    expect(filterConversations(items, "  ")).toHaveLength(2);
  });
});

describe("buildMessageList", () => {
  it("ordena por provider_timestamp ascendente", () => {
    const list = buildMessageList([
      messageRow({ id: "b", provider_timestamp: "2026-10-01T12:00:00Z" }),
      messageRow({ id: "a", provider_timestamp: "2026-10-01T09:00:00Z" }),
      messageRow({ id: "c", provider_timestamp: "2026-10-01T15:00:00Z" }),
    ]);
    expect(list.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("mapMessageRow", () => {
  it("text: muestra el texto y no lleva etiqueta", () => {
    const m = mapMessageRow(messageRow({ id: "1", text: "Buenas tardes" }));
    expect(m).toMatchObject({ contentType: "text", text: "Buenas tardes", label: null });
  });

  it("audio: nota de voz solo si el proveedor lo indica", () => {
    const voice = mapMessageRow(
      messageRow({ id: "1", content_type: "audio", text: null, media: { isVoiceMessage: true } })
    );
    const plain = mapMessageRow(
      messageRow({ id: "2", content_type: "audio", text: null, media: { mimeType: "audio/mpeg" } })
    );
    expect(voice.label).toBe("🎤 Nota de voz");
    expect(plain.label).toBe("🎤 Audio");
    expect(voice.text).toBeNull();
  });

  it("image: etiqueta y pie de foto", () => {
    const m = mapMessageRow(
      messageRow({ id: "1", content_type: "image", text: null, media: { caption: "La carta" } })
    );
    expect(m).toMatchObject({ label: "🖼️ Imagen", caption: "La carta", text: null });
  });

  it("video", () => {
    const m = mapMessageRow(messageRow({ id: "1", content_type: "video", text: null, media: {} }));
    expect(m.label).toBe("🎥 Vídeo");
  });

  it("document: etiqueta y nombre de archivo", () => {
    const m = mapMessageRow(
      messageRow({ id: "1", content_type: "document", text: null, media: { filename: "menu.pdf" } })
    );
    expect(m).toMatchObject({ label: "📄 Documento", filename: "menu.pdf" });
  });

  it("sticker", () => {
    const m = mapMessageRow(messageRow({ id: "1", content_type: "sticker", text: null }));
    expect(m.label).toBe("Sticker");
  });

  it("unsupported y tipos desconocidos", () => {
    expect(mapMessageRow(messageRow({ id: "1", content_type: "unsupported", text: null })).label).toBe(
      "Mensaje no compatible"
    );
    expect(mapMessageRow(messageRow({ id: "2", content_type: "location", text: null })).contentType).toBe(
      "unsupported"
    );
  });

  it("direction: inbound a la izquierda, outbound a la derecha", () => {
    expect(mapMessageRow(messageRow({ id: "1" })).direction).toBe("inbound");
    expect(mapMessageRow(messageRow({ id: "2", direction: "outbound" })).direction).toBe("outbound");
  });

  it("nunca expone raw_payload, IDs externos ni el media completo", () => {
    const dirty = {
      ...messageRow({
        id: "1",
        content_type: "image",
        text: null,
        media: { externalMediaId: "MEDIA-SECRET", mimeType: "image/jpeg", caption: "x" },
      }),
      raw_payload: { secret: "RAW-SECRET" },
      external_id: "wamid.SECRET",
    };
    const m = mapMessageRow(dirty);
    const json = JSON.stringify(m);
    expect(json).not.toContain("RAW-SECRET");
    expect(json).not.toContain("MEDIA-SECRET");
    expect(json).not.toContain("wamid.SECRET");
    expect(Object.keys(m)).not.toContain("raw_payload");
    expect(Object.keys(m)).not.toContain("media");
  });
});

describe("isValidConversationId", () => {
  it("solo acepta UUID", () => {
    expect(isValidConversationId("3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b")).toBe(true);
    expect(isValidConversationId("not-a-uuid")).toBe(false);
    expect(isValidConversationId("1; drop table")).toBe(false);
  });
});
