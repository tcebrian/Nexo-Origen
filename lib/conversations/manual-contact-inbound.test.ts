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
    marcas: [
      { id: 10, nombre: "Burger King" },
      { id: 20, nombre: "Popeyes" },
    ],
    restaurantes: [
      { id: 1, nombre: "Zizur", empresa_id: 1, marca_id: 10 },
      { id: 2, nombre: "Tudela", empresa_id: 1, marca_id: 10 },
      { id: 3, nombre: "Soria", empresa_id: 1, marca_id: 10 },
      { id: 4, nombre: "Tudela", empresa_id: 1, marca_id: 20 },
    ],
    conv_canales: [
      { id: "canal-1", provider: "whatsapp_cloud", external_account_id: CHANNEL, waba_id: "w", display_phone: "+34688718820", status: "connected" },
    ],
    conv_contactos: [],
    conv_contacto_empresas: [],
    conv_contacto_restaurantes: [],
    conv_conversaciones: [],
    conv_mensajes: [],
  });
  fake.uniques.conv_contactos = [{ columns: ["telefono_e164"], constraint: "conv_contactos_telefono_e164_key" }];
  fake.uniques.conv_conversaciones = [{ columns: ["canal_id", "contacto_id"], constraint: "conv_conversaciones_canal_id_contacto_id_key" }];
  fake.uniques.conv_mensajes = [{ columns: ["canal_id", "external_id"], constraint: "conv_mensajes_canal_id_external_id_key" }];
  return fake;
}

const { createManualContact } = await import("@/lib/conversations/manual-contact.server");
const { ingestInboundMessage } = await import("@/lib/conversations/ingest-inbound");
const { conversationsRepository } = await import("@/lib/supabase/conversations.server");
const { resolveContactRestaurantIds } = await import("@/lib/conversations/contact-scope.server");

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

/** Efecto de la transacción `nexo_set_contact_access` (que en la base real hace la función SQL). */
function grant(contactId: string, restaurantIds: number[], todos = false) {
  db.tables.conv_contacto_empresas!.push({ contacto_id: contactId, empresa_id: 1, todos_restaurantes: todos });
  for (const restaurante_id of todos ? [] : restaurantIds) {
    db.tables.conv_contacto_restaurantes!.push({ contacto_id: contactId, empresa_id: 1, restaurante_id });
  }
}

beforeEach(() => {
  db = seed();
});

describe("persona dada de alta a mano que escribe después", () => {
  async function victor() {
    const manual = (await createManualContact({
      nombre: "Víctor",
      telefonoE164: PHONE,
      access: { tipo: "supervisor", empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 2, 4] },
    })) as { contactId: string; conversationId: string };
    db.tables.conv_contactos![0]!.tipo = "supervisor"; // lo que guarda la transacción de permisos
    grant(manual.contactId, [1, 2, 4]);
    return manual;
  }

  it("el mensaje entrante reutiliza el contacto y la conversación creados a mano", async () => {
    const manual = await victor();
    const result = await receive();

    expect(result).toMatchObject({ status: "stored", contactCreated: false, conversationCreated: false });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_conversaciones).toHaveLength(1);
    expect((result as { contactId: string }).contactId).toBe(manual.contactId);
    expect((result as { conversationId: string }).conversationId).toBe(manual.conversationId);
  });

  it("conserva su nombre, su tipo y sus permisos; el nombre de perfil de WhatsApp va a su propio campo", async () => {
    await victor();
    db.tables.conv_contactos![0]!.nombre = "Víctor";
    await receive();

    expect(db.tables.conv_contactos![0]).toMatchObject({
      telefono_e164: PHONE,
      nombre: "Víctor",
      tipo: "supervisor",
      nombre_perfil: "Víctor (perfil WhatsApp)",
    });
    expect(db.tables.conv_contacto_empresas).toHaveLength(1);
    expect(db.tables.conv_contacto_restaurantes).toHaveLength(3);
  });

  it("sigue con acceso exactamente a sus restaurantes después de escribir (no se pierde ni se amplía)", async () => {
    const manual = await victor();
    await receive();
    expect(await resolveContactRestaurantIds(manual.contactId)).toEqual([1, 2, 4]);
  });

  it("un segundo mensaje con el mismo wamid no duplica nada", async () => {
    await victor();
    await receive();
    expect(await receive()).toMatchObject({ status: "duplicate" });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_mensajes).toHaveLength(1);
  });
});

describe("desconocidos que escriben", () => {
  it("se guardan como contacto y conversación para poder verlos, sin empresa ni restaurantes", async () => {
    const result = (await receive(inbound({ senderPhone: "+34611111111", senderProfileName: "Desconocido" }))) as {
      status: string;
      contactId: string;
      contactCreated: boolean;
    };

    expect(result).toMatchObject({ status: "stored", contactCreated: true });
    expect(db.tables.conv_contacto_empresas).toHaveLength(0);
    expect(db.tables.conv_contacto_restaurantes).toHaveLength(0);
    expect(db.tables.conv_contactos!.find((c) => c.id === result.contactId)!.nombre ?? null).toBeNull();
  });

  it("su alcance es [] (deny): no consulta datos ni recibe informes ni alertas", async () => {
    const result = (await receive(inbound({ senderPhone: "+34611111111" }))) as { contactId: string };
    expect(await resolveContactRestaurantIds(result.contactId)).toEqual([]);
  });

  it("un número casi igual a uno autorizado es otro contacto y no hereda sus permisos", async () => {
    const manual = (await createManualContact({
      nombre: "Víctor",
      telefonoE164: PHONE,
      access: { empresaId: 1, restaurantIds: [1] },
    })) as { contactId: string };
    grant(manual.contactId, [1]);

    const other = (await receive(inbound({ senderPhone: "+34688718821", senderProfileName: "Víctor" }))) as { contactId: string };
    expect(db.tables.conv_contactos).toHaveLength(2);
    expect(await resolveContactRestaurantIds(other.contactId)).toEqual([]);
    expect(await resolveContactRestaurantIds(manual.contactId)).toEqual([1]);
  });

  it("puede abrirse después y recibir permisos manualmente", async () => {
    const result = (await receive(inbound({ senderPhone: "+34611111111" }))) as { contactId: string };
    expect(await resolveContactRestaurantIds(result.contactId)).toEqual([]);

    grant(result.contactId, [3]);
    expect(await resolveContactRestaurantIds(result.contactId)).toEqual([3]);
  });
});

describe("la cuenta web no interviene", () => {
  it("un contacto sin usuario_id tiene permisos de WhatsApp igualmente", async () => {
    const manual = (await createManualContact({
      nombre: "Sin cuenta",
      telefonoE164: PHONE,
      access: { empresaId: 1, todosRestaurantes: true },
    })) as { contactId: string };
    grant(manual.contactId, [], true);

    expect(db.tables.conv_contactos![0]!.usuario_id ?? null).toBeNull();
    expect(await resolveContactRestaurantIds(manual.contactId)).toEqual([1, 2, 3, 4]);
    // Un restaurante nuevo de la empresa entra solo con "todos".
    db.tables.restaurantes!.push({ id: 5, nombre: "Nuevo", empresa_id: 1, marca_id: 10 });
    expect(await resolveContactRestaurantIds(manual.contactId)).toContain(5);
  });
});
