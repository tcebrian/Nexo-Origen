import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

vi.mock("@/lib/conversations/outbound.server", async () => {
  const helper = await import("@/lib/conversations/outbound-fake.test-helper");
  return { outboundRepository: helper.createFakeOutboundRepo().repo };
});

const sendTemplateMessage = vi.fn();
const sendTextMessage = vi.fn();
vi.mock("@/lib/whatsapp/cloud-api.server", () => ({
  isWhatsAppSenderConfigured: () => true,
  sendTemplateMessage,
  sendTextMessage,
  sendDocumentMessage: vi.fn(),
  sendImageMessage: vi.fn(),
  uploadMedia: vi.fn(),
}));

const PHONE = "+34688718820";
// El repositorio de envío simulado conoce esta conversación y este teléfono.
const OUTBOUND_CONVERSATION = "3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b";
const OUTBOUND_PHONE = "+34600111222";

function seed() {
  const fake = createFakeDb({
    empresas: [{ id: 1, nombre: "Grupo" }],
    marcas: [{ id: 10, nombre: "Burger King" }],
    restaurantes: [
      { id: 1, nombre: "Zizur", ciudad: "Zizur", empresa_id: 1, marca_id: 10, activo: true },
      { id: 2, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 10, activo: true },
    ],
    conv_canales: [{ id: "canal-1", provider: "whatsapp_cloud", status: "connected", external_account_id: "1365004563368241" }],
    conv_contactos: [],
    conv_conversaciones: [],
    conv_contacto_empresas: [{ contacto_id: "c-1", empresa_id: 1, todos_restaurantes: false }],
    conv_contacto_restaurantes: [
      { contacto_id: "c-1", restaurante_id: 1 },
      { contacto_id: "c-1", restaurante_id: 2 },
    ],
  });
  fake.uniques.conv_contactos = [{ columns: ["telefono_e164"], constraint: "conv_contactos_telefono_e164_key" }];
  fake.uniques.conv_conversaciones = [{ columns: ["canal_id", "contacto_id"], constraint: "conv_conversaciones_canal_id_contacto_id_key" }];
  return fake;
}

const { createManualContact } = await import("@/lib/conversations/manual-contact.server");
const { contactActivationRepository, runInboundAction } = await import("@/lib/conversations/contact-activation.server");
const { resolveContactRestaurantIds } = await import("@/lib/conversations/contact-scope.server");

beforeEach(() => {
  db = seed();
  sendTemplateMessage.mockReset();
  sendTextMessage.mockReset();
});

const access = { tipo: "supervisor", empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 2] };

describe("crear un contacto NO activa nada", () => {
  it("no envía ninguna plantilla ni texto, y el contacto nace con las dos fechas a null", async () => {
    const result = await createManualContact({ nombre: "Víctor", telefonoE164: PHONE, access });

    expect(result.status).toBe("created");
    expect(sendTemplateMessage).not.toHaveBeenCalled();
    expect(sendTextMessage).not.toHaveBeenCalled();
    expect(db.tables.conv_mensajes ?? []).toHaveLength(0);

    const contact = db.tables.conv_contactos![0]!;
    expect(contact.welcome_sent_at ?? null).toBeNull();
    expect(contact.whatsapp_activated_at ?? null).toBeNull();

    const loaded = await contactActivationRepository.getByConversation(result.conversationId!);
    expect(loaded).toMatchObject({ welcomeSentAt: null, activatedAt: null, phone: PHONE });
  });
});

describe("repositorio de activación", () => {
  beforeEach(() => {
    db.tables.conv_contactos!.push({ id: "c-1", telefono_e164: PHONE, nombre: "Víctor", nombre_perfil: null, welcome_sent_at: null, whatsapp_activated_at: null });
    db.tables.conv_conversaciones!.push({ id: "conv-1", canal_id: "canal-1", contacto_id: "c-1" });
  });

  it("markActivated solo escribe una vez: la segunda llamada no cambia la fecha", async () => {
    const first = new Date("2026-10-08T09:00:00Z");
    expect(await contactActivationRepository.markActivated("c-1", first)).toBe(true);
    expect(await contactActivationRepository.markActivated("c-1", new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(db.tables.conv_contactos![0]!.whatsapp_activated_at).toBe(first.toISOString());
    expect(await contactActivationRepository.isActivated("c-1")).toBe(true);
    expect(await contactActivationRepository.isActivated("nadie")).toBeNull();
  });

  it("markWelcomeSent solo escribe una vez", async () => {
    const first = new Date("2026-10-08T09:00:00Z");
    expect(await contactActivationRepository.markWelcomeSent("c-1", first)).toBe(true);
    expect(await contactActivationRepository.markWelcomeSent("c-1", new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(db.tables.conv_contactos![0]!.welcome_sent_at).toBe(first.toISOString());
  });

  it("activar WhatsApp no cambia los permisos por restaurantes", async () => {
    const before = await resolveContactRestaurantIds("c-1");
    const tablesBefore = JSON.stringify([db.tables.conv_contacto_empresas, db.tables.conv_contacto_restaurantes]);

    await contactActivationRepository.markActivated("c-1", new Date());

    expect(await resolveContactRestaurantIds("c-1")).toEqual(before);
    expect(JSON.stringify([db.tables.conv_contacto_empresas, db.tables.conv_contacto_restaurantes])).toBe(tablesBefore);
  });

  it("usuario_id null no bloquea la activación", async () => {
    expect(db.tables.conv_contactos![0]!.usuario_id ?? null).toBeNull();
    expect(await contactActivationRepository.markActivated("c-1", new Date())).toBe(true);
  });
});

describe("acción entrante de punta a punta (repositorio real, Meta simulado)", () => {
  beforeEach(() => {
    db.tables.conv_contactos!.push({ id: "c-1", telefono_e164: PHONE, nombre: "Víctor", nombre_perfil: null, welcome_sent_at: "2026-10-08T08:00:00Z", whatsapp_activated_at: null });
    db.tables.conv_conversaciones!.push({ id: OUTBOUND_CONVERSATION, canal_id: "canal-1", contacto_id: "c-1" });
    db.tables.conv_mensajes = [];
    sendTextMessage.mockResolvedValue({ status: "sent", wamid: "wamid.R1" });
  });

  const click = (id = "wamid.IN1", redelivery = false) =>
    runInboundAction(
      {
        externalMessageId: id,
        channelExternalId: "1365004563368241",
        senderPhone: PHONE,
        contentType: "text",
        text: "Activar servicio",
        interactive: { id: "nexo:activate_service", title: "Activar servicio" },
        providerTimestamp: new Date(),
      },
      { contactId: "c-1", conversationId: OUTBOUND_CONVERSATION, redelivery }
    );

  it("el botón Activar servicio activa el contacto y responde con un texto normal", async () => {
    expect(await click()).toEqual({ action: "ACTIVATE_SERVICE" });
    expect(db.tables.conv_contactos![0]!.whatsapp_activated_at).toBeTruthy();
    expect(sendTextMessage).toHaveBeenCalledTimes(1);
    expect(sendTextMessage.mock.calls[0]![0]).toMatchObject({ phoneNumberId: "1365004563368241", to: OUTBOUND_PHONE });
    expect(sendTextMessage.mock.calls[0]![0].text).toContain("✅ Servicio activado.");
    expect(sendTemplateMessage).not.toHaveBeenCalled();
  });

  it("segundo clic: ni cambia la fecha ni vuelve a responder", async () => {
    await click("wamid.IN-S1");
    const activatedAt = db.tables.conv_contactos![0]!.whatsapp_activated_at;
    await click("wamid.IN-S2");

    expect(db.tables.conv_contactos![0]!.whatsapp_activated_at).toBe(activatedAt);
    expect(sendTextMessage).toHaveBeenCalledTimes(1);
  });
});
