import { describe, expect, it } from "vitest";
import type { InboundMessage } from "@/lib/conversations/types";
import {
  CONV_CONSTRAINTS,
  buildContactPatch,
  buildInboundMessageRow,
  classifyMessageInsertError,
  isUniqueViolation,
  lastMessageGuardFilter,
  mapChannelRow,
  mapContactRow,
  mapConversationRow,
} from "./conversations-mappers";

const message: InboundMessage = {
  externalMessageId: "wamid.TEST1",
  channelExternalId: "100000000000001",
  senderPhone: "+34600000001",
  contentType: "text",
  text: "Hola",
  providerTimestamp: new Date("2025-10-09T08:53:20.000Z"),
  raw: { from: "34600000001", id: "wamid.TEST1" },
};

describe("buildInboundMessageRow", () => {
  const row = buildInboundMessageRow({ message, empresaId: 7, canalId: "canal-1", conversacionId: "conv-1" });

  it("usa la empresa y el canal recibidos (resueltos en servidor), no datos del mensaje", () => {
    expect(row).toMatchObject({
      empresa_id: 7,
      canal_id: "canal-1",
      conversacion_id: "conv-1",
      external_id: "wamid.TEST1",
    });
  });

  it("es un mensaje entrante del contacto, en estado received", () => {
    expect(row).toMatchObject({ direction: "inbound", sender_type: "contact", status: "received" });
  });

  it("guarda texto y fecha del proveedor en ISO", () => {
    expect(row.content_type).toBe("text");
    expect(row.text).toBe("Hola");
    expect(row.media).toBeNull();
    expect(row.provider_timestamp).toBe("2025-10-09T08:53:20.000Z");
  });

  it("NO persiste raw_payload (ni la clave existe, queda NULL por defecto)", () => {
    expect("raw_payload" in row).toBe(false);
    expect(JSON.stringify(row)).not.toContain("from");
  });

  it("guarda solo los metadatos del medio", () => {
    const media = { externalMediaId: "m1", mimeType: "audio/ogg", isVoiceMessage: true };
    const audio = buildInboundMessageRow({
      message: { ...message, contentType: "audio", text: undefined, media },
      empresaId: 7,
      canalId: "c",
      conversacionId: "v",
    });
    expect(audio.content_type).toBe("audio");
    expect(audio.text).toBeNull();
    expect(audio.media).toEqual(media);
  });
});

describe("buildContactPatch", () => {
  const existing = { nombrePerfil: "JR 🍔", externalContactId: "34600000001" };

  it("sin novedades → null", () => {
    expect(buildContactPatch(existing, {})).toBeNull();
    expect(buildContactPatch(existing, { profileName: "JR 🍔", externalContactId: "34600000001" })).toBeNull();
  });

  it("ignora valores vacíos o en blanco (no borra lo que ya hay)", () => {
    expect(buildContactPatch(existing, { profileName: "", externalContactId: "  " })).toBeNull();
    expect(buildContactPatch(existing, { profileName: null, externalContactId: null })).toBeNull();
  });

  it("actualiza nombre_perfil cuando llega uno nuevo", () => {
    expect(buildContactPatch(existing, { profileName: "  José R.  " })).toEqual({ nombre_perfil: "José R." });
  });

  it("rellena campos que faltaban", () => {
    expect(
      buildContactPatch({ nombrePerfil: null, externalContactId: null }, { profileName: "Ana", externalContactId: "34600000002" })
    ).toEqual({ nombre_perfil: "Ana", external_contact_id: "34600000002" });
  });

  it("nunca incluye `nombre` (nombre manual intocable)", () => {
    const patches = [
      buildContactPatch(existing, { profileName: "Otro" }),
      buildContactPatch({ nombrePerfil: null, externalContactId: null }, { profileName: "Ana", externalContactId: "1" }),
    ];
    for (const patch of patches) {
      expect(patch).not.toBeNull();
      expect("nombre" in (patch as object)).toBe(false);
    }
  });
});

describe("duplicados e idempotencia", () => {
  const duplicate = {
    code: "23505",
    message: `duplicate key value violates unique constraint "${CONV_CONSTRAINTS.mensajeCanalExternalId}"`,
  };

  it("sin error → inserted", () => {
    expect(classifyMessageInsertError(null)).toEqual({ status: "inserted" });
  });

  it("violación de (canal_id, external_id) → duplicate, resultado normal", () => {
    expect(classifyMessageInsertError(duplicate)).toEqual({ status: "duplicate" });
  });

  it("otra violación de unicidad o cualquier otro error → error", () => {
    expect(
      classifyMessageInsertError({ code: "23505", message: 'violates unique constraint "otra_key"' })
    ).toEqual({ status: "error" });
    expect(classifyMessageInsertError({ code: "23503", message: "foreign key violation" })).toEqual({ status: "error" });
    expect(classifyMessageInsertError({ code: "08006", message: "connection failure" })).toEqual({ status: "error" });
  });

  it("isUniqueViolation exige código 23505 y la restricción concreta", () => {
    expect(isUniqueViolation(duplicate, CONV_CONSTRAINTS.mensajeCanalExternalId)).toBe(true);
    expect(isUniqueViolation(duplicate, CONV_CONSTRAINTS.contactoTelefono)).toBe(false);
    expect(isUniqueViolation({ code: "23514", message: CONV_CONSTRAINTS.mensajeCanalExternalId }, CONV_CONSTRAINTS.mensajeCanalExternalId)).toBe(false);
    expect(isUniqueViolation(undefined, CONV_CONSTRAINTS.mensajeCanalExternalId)).toBe(false);
  });
});

describe("lastMessageGuardFilter (no retroceder)", () => {
  it("solo permite escribir si no hay fecha o la actual es estrictamente anterior", () => {
    const filter = lastMessageGuardFilter(new Date("2025-10-09T10:02:00.000Z"));
    expect(filter).toBe(
      "ultimo_mensaje_at.is.null,ultimo_mensaje_at.lt.2025-10-09T10:02:00.000Z"
    );
    expect(filter).not.toContain(".lte.");
    expect(filter).not.toContain(".gt");
  });
});

describe("mapeo de filas", () => {
  it("canal: convierte empresa_id bigint a número", () => {
    expect(
      mapChannelRow({
        id: "c1",
        empresa_id: "12",
        provider: "whatsapp_cloud",
        external_account_id: "1000",
        waba_id: null,
        display_phone: null,
        status: "connected",
      })
    ).toEqual({
      id: "c1",
      empresaId: 12,
      provider: "whatsapp_cloud",
      externalAccountId: "1000",
      wabaId: null,
      displayPhone: null,
      status: "connected",
    });
  });

  it("contacto: distingue nombre y nombre_perfil", () => {
    const contact = mapContactRow({
      id: "p1",
      empresa_id: 1,
      telefono_e164: "+34600000001",
      nombre: "José Ramón",
      nombre_perfil: "JR 🍔",
      external_contact_id: null,
    });
    expect(contact.nombre).toBe("José Ramón");
    expect(contact.nombrePerfil).toBe("JR 🍔");
  });

  it("conversación: parsea la fecha del último mensaje", () => {
    const conversation = mapConversationRow({
      id: "v1",
      empresa_id: 1,
      canal_id: "c1",
      contacto_id: "p1",
      estado: "open",
      ultimo_mensaje_at: "2025-10-09T10:05:00+00:00",
      ultimo_mensaje_preview: "Hola",
    });
    expect(conversation.ultimoMensajeAt).toEqual(new Date("2025-10-09T10:05:00.000Z"));
    expect(mapConversationRow({ ...{ id: "v", empresa_id: 1, canal_id: "c", contacto_id: "p", estado: "open", ultimo_mensaje_preview: null }, ultimo_mensaje_at: null }).ultimoMensajeAt).toBeNull();
  });
});
