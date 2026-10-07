import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";
import type { InboundMessage } from "@/lib/conversations/types";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

const CHANNEL = "1365004563368241";
const PHONE = "+34688718820";

function seed() {
  const fake = createFakeDb({
    empresas: [{ id: 1, nombre: "Grupo" }],
    marcas: [{ id: 10, nombre: "Burger King" }],
    restaurantes: [
      { id: 1, empresa_id: 1, marca_id: 10 },
      { id: 2, empresa_id: 1, marca_id: 10 },
      { id: 3, empresa_id: 1, marca_id: 10 },
    ],
    perfiles: [{ id: "u-victor", nombre: "Víctor", email: "v@x.test", rol: "restaurante_user", empresa_id: 1 }],
    usuario_restaurantes: [
      { user_id: "u-victor", restaurante_id: 1 },
      { user_id: "u-victor", restaurante_id: 3 },
    ],
    usuario_marcas: [],
    conv_canales: [
      { id: "canal-1", provider: "whatsapp_cloud", external_account_id: CHANNEL, waba_id: "w", display_phone: "+34688718820", status: "connected" },
    ],
    conv_contactos: [],
    conv_conversaciones: [],
    conv_mensajes: [],
  });
  fake.uniques.conv_contactos = [
    { columns: ["telefono_e164"], constraint: "conv_contactos_telefono_e164_key" },
    { columns: ["usuario_id"], constraint: "conv_contactos_usuario_id_key" },
  ];
  fake.uniques.conv_conversaciones = [{ columns: ["canal_id", "contacto_id"], constraint: "conv_conversaciones_canal_id_contacto_id_key" }];
  fake.uniques.conv_mensajes = [{ columns: ["canal_id", "external_id"], constraint: "conv_mensajes_canal_id_external_id_key" }];
  return fake;
}

const { createManualContact } = await import("@/lib/conversations/manual-contact.server");
const { ingestInboundMessage } = await import("@/lib/conversations/ingest-inbound");
const { conversationsRepository } = await import("@/lib/supabase/conversations.server");
const { resolveContactDataScope, resolveContactRestaurantIds } = await import("@/lib/conversations/contact-scope.server");

function inbound(over: Partial<InboundMessage> = {}): InboundMessage {
  return {
    externalMessageId: "wamid.IN1",
    channelExternalId: CHANNEL,
    senderPhone: PHONE,
    senderProfileName: "Víctor (perfil WhatsApp)",
    contentType: "text",
    text: "Hola",
    providerTimestamp: new Date("2026-10-08T08:00:00Z"),
    ...over,
  };
}

const receive = (message = inbound()) => ingestInboundMessage(conversationsRepository, "whatsapp_cloud", message);

beforeEach(() => {
  db = seed();
});

describe("persona dada de alta a mano que escribe después", () => {
  it("el mensaje entrante reutiliza el contacto y la conversación creados a mano", async () => {
    const manual = await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: "u-victor" });
    expect(manual.status).toBe("created");

    const result = await receive();

    expect(result).toMatchObject({ status: "stored", contactCreated: false, conversationCreated: false });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_conversaciones).toHaveLength(1);
    expect(db.tables.conv_mensajes).toHaveLength(1);
    expect((result as { contactId: string }).contactId).toBe((manual as { contactId: string }).contactId);
    expect((result as { conversationId: string }).conversationId).toBe((manual as { conversationId: string }).conversationId);
  });

  it("conserva el usuario vinculado y el nombre; el nombre de perfil de WhatsApp va a su propio campo", async () => {
    await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: "u-victor" });
    await receive();

    expect(db.tables.conv_contactos![0]).toMatchObject({
      telefono_e164: PHONE,
      nombre: "Víctor",
      usuario_id: "u-victor",
      nombre_perfil: "Víctor (perfil WhatsApp)",
    });
  });

  it("sigue con acceso a sus restaurantes después de escribir (el permiso no se pierde ni se amplía)", async () => {
    await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: "u-victor" });
    const contactId = (await receive() as { contactId: string }).contactId;
    expect(await resolveContactRestaurantIds(contactId)).toEqual([1, 3]);
  });

  it("un segundo mensaje del mismo wamid no duplica nada", async () => {
    await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: "u-victor" });
    await receive();
    expect(await receive()).toMatchObject({ status: "duplicate" });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_mensajes).toHaveLength(1);
  });

  it("un contacto manual SIN usuario sigue sin acceso tras escribir", async () => {
    await createManualContact({ nombre: "Sin vincular", telefonoE164: PHONE, usuarioId: null });
    const contactId = (await receive() as { contactId: string }).contactId;
    expect(db.tables.conv_contactos![0]!.usuario_id ?? null).toBeNull();
    expect(await resolveContactRestaurantIds(contactId)).toEqual([]);
  });
});

describe("desconocidos que escriben", () => {
  it("se guardan como contacto y conversación para poder verlos, pero sin usuario Nexo", async () => {
    const result = await receive(inbound({ senderPhone: "+34611111111", senderProfileName: "Desconocido" }));

    expect(result).toMatchObject({ status: "stored", contactCreated: true, conversationCreated: true });
    const contact = db.tables.conv_contactos!.find((c) => c.telefono_e164 === "+34611111111")!;
    expect(contact.usuario_id ?? null).toBeNull();
    expect(contact.nombre ?? null).toBeNull();
  });

  it("su alcance es vacío (deny): no consulta datos ni recibe informes", async () => {
    const result = (await receive(inbound({ senderPhone: "+34611111111" }))) as { contactId: string };
    expect(await resolveContactRestaurantIds(result.contactId)).toEqual([]);
    expect(await resolveContactDataScope(result.contactId)).toMatchObject({ restauranteIds: [], marcaIds: [] });
  });

  it("no se vincula por parecido: un número casi igual a uno autorizado es otro contacto sin acceso", async () => {
    await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: "u-victor" });
    const result = (await receive(inbound({ senderPhone: "+34688718821", senderProfileName: "Víctor" }))) as { contactId: string };

    expect(db.tables.conv_contactos).toHaveLength(2);
    expect(db.tables.conv_contactos!.find((c) => c.id === result.contactId)!.usuario_id ?? null).toBeNull();
    expect(await resolveContactRestaurantIds(result.contactId)).toEqual([]);
  });

  it("crear a mano un contacto sin usuario no concede ningún acceso", async () => {
    const manual = (await createManualContact({ nombre: "Nuevo", telefonoE164: "+34622222222", usuarioId: null })) as {
      contactId: string;
    };
    expect(await resolveContactRestaurantIds(manual.contactId)).toEqual([]);
  });
});

describe("contacto manual con usuario: mismo alcance que la web", () => {
  it("el alcance del contacto es el del usuario vinculado y cambia con sus permisos", async () => {
    const manual = (await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: "u-victor" })) as {
      contactId: string;
    };
    expect(await resolveContactRestaurantIds(manual.contactId)).toEqual([1, 3]);

    db.tables.usuario_restaurantes = [
      { user_id: "u-victor", restaurante_id: 1 },
      { user_id: "u-victor", restaurante_id: 2 },
    ];
    expect(await resolveContactRestaurantIds(manual.contactId)).toEqual([1, 2]);
  });
});
