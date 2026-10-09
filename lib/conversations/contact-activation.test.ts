import { describe, expect, it, vi } from "vitest";
import {
  contactWhatsAppState,
  sendContactActivation,
  type ContactActivation,
  type ContactActivationRepository,
} from "@/lib/conversations/contact-activation";
import { CONVERSATION_ID, createFakeOutboundRepo } from "@/lib/conversations/outbound-fake.test-helper";
import { ACTION_BUTTONS, WHATSAPP_TEMPLATES } from "@/lib/conversations/whatsapp-templates";
import type { SendMessageResult } from "@/lib/whatsapp/cloud-api.server";

const NOW = new Date("2026-10-08T09:00:00.000Z");

function setup(over: { contact?: Partial<ContactActivation> | null; template?: () => Promise<SendMessageResult> } = {}) {
  const fake = createFakeOutboundRepo();
  const contact: ContactActivation | null =
    over.contact === null
      ? null
      : { id: "contact-1", phone: "+34600111222", name: "Víctor", welcomeSentAt: null, activatedAt: null, ...over.contact };
  const marks: Date[] = [];
  const activations: ContactActivationRepository = {
    async getByConversation(id) {
      return contact && id === CONVERSATION_ID ? { ...contact } : null;
    },
    async markWelcomeSent(_id, at) {
      if (contact!.welcomeSentAt) return false;
      contact!.welcomeSentAt = at.toISOString();
      marks.push(at);
      return true;
    },
  };
  const sendTemplate = vi.fn(over.template ?? (async () => ({ status: "sent", wamid: "wamid.W1" }) as const));
  const sendText = vi.fn();
  const run = () =>
    sendContactActivation(
      { conversationId: CONVERSATION_ID },
      {
        activations,
        sendTemplate,
        now: () => NOW,
        send: {
          repository: fake.repo,
          sendText,
          uploadMedia: vi.fn(),
          sendDocument: vi.fn(),
          sendImage: vi.fn(),
          isConfigured: () => true,
          logger: { error: () => {} },
        },
      }
    );
  return { ...fake, contact, marks, sendTemplate, sendText, run };
}

describe("Enviar activación (manual)", () => {
  it("envía bienvenido_nexo con {{1}} = nombre y el botón Activar servicio, y guarda welcome_sent_at", async () => {
    const t = setup();
    const outcome = await t.run();

    expect(outcome).toMatchObject({ status: "sent", whatsapp: { state: "sent", welcomeSentAt: NOW.toISOString(), activatedAt: null } });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);
    expect(t.sendTemplate).toHaveBeenCalledWith({
      phoneNumberId: "1365004563368241",
      to: "+34600111222",
      template: {
        name: "bienvenido_nexo",
        language: "es",
        bodyParams: ["Víctor"],
        buttonPayloads: [ACTION_BUTTONS.ACTIVATE_SERVICE.payload],
      },
    });
    expect(t.sendText).not.toHaveBeenCalled();
    expect(t.contact!.welcomeSentAt).toBe(NOW.toISOString());
    expect(t.contact!.activatedAt).toBeNull();
  });

  it("registra el outbound normal (sent) sin datos del contacto en el texto", async () => {
    const t = setup();
    await t.run();
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      content_type: "text",
      text: WHATSAPP_TEMPLATES.bienvenido_nexo.display,
      external_id: "wamid.W1",
      status: "sent",
    });
    expect(t.rows[0]!.text).not.toMatch(/Víctor|\+34/);
    expect(t.touches).toHaveLength(1);
  });

  it("sin nombre usa un texto neutro como {{1}}", async () => {
    const t = setup({ contact: { name: null } });
    await t.run();
    expect(t.sendTemplate.mock.calls[0]![0].template.bodyParams).toEqual(["equipo"]);
  });

  it("segundo envío: se bloquea si la activación ya se envió o el contacto ya está activo", async () => {
    const t = setup();
    await t.run();
    expect(await t.run()).toEqual({ status: "already_sent" });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);

    const active = setup({ contact: { activatedAt: NOW.toISOString() } });
    expect(await active.run()).toEqual({ status: "already_active" });
    expect(active.sendTemplate).not.toHaveBeenCalled();
    expect(active.rows).toHaveLength(0);
  });

  it("si Meta rechaza el envío, welcome_sent_at sigue null y se puede volver a pulsar", async () => {
    let calls = 0;
    const t = setup({
      template: async () => (++calls === 1 ? { status: "rejected", reason: "other" } : { status: "sent", wamid: "wamid.W2" }),
    });

    expect(await t.run()).toMatchObject({ status: "rejected" });
    expect(t.contact!.welcomeSentAt).toBeNull();
    expect(t.rows[0]!.status).toBe("failed");

    // Nada se reintenta solo: hasta que se pulsa otra vez no hay más llamadas.
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);

    expect(await t.run()).toMatchObject({ status: "sent" });
    expect(t.rows).toHaveLength(1); // se reutiliza la misma fila
    expect(t.contact!.welcomeSentAt).toBe(NOW.toISOString());
  });

  it("resultado incierto (timeout): welcome_sent_at sigue null y un nuevo clic NO duplica la plantilla", async () => {
    const t = setup({ template: async () => ({ status: "unconfirmed" }) });
    expect(await t.run()).toMatchObject({ status: "unconfirmed" });
    expect(t.contact!.welcomeSentAt).toBeNull();

    expect(await t.run()).toMatchObject({ status: "in_progress" });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);
  });

  it("si la plantilla salió pero no se guardó la fecha, otro clic la repara sin reenviar", async () => {
    const t = setup();
    t.sendTemplate.mockResolvedValue({ status: "sent", wamid: "wamid.W1" });
    await t.run();
    t.contact!.welcomeSentAt = null; // simula un fallo al guardar la fecha

    expect(await t.run()).toMatchObject({ status: "sent" });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);
    expect(t.contact!.welcomeSentAt).toBe(NOW.toISOString());
  });

  it("contacto sin conversación → contact_not_found y no se envía nada", async () => {
    const t = setup({ contact: null });
    expect(await t.run()).toEqual({ status: "contact_not_found" });
    expect(t.sendTemplate).not.toHaveBeenCalled();
  });
});

describe("estado del contacto", () => {
  it("Pendiente → Activación enviada → Activo", () => {
    expect(contactWhatsAppState({ welcomeSentAt: null, activatedAt: null }).state).toBe("pending");
    expect(contactWhatsAppState({ welcomeSentAt: "2026-10-08T09:00:00Z", activatedAt: null }).state).toBe("sent");
    expect(contactWhatsAppState({ welcomeSentAt: "2026-10-08T09:00:00Z", activatedAt: "2026-10-08T09:05:00Z" }).state).toBe("active");
    // Activo aunque nunca se enviara la plantilla (la persona escribió OK por su cuenta).
    expect(contactWhatsAppState({ welcomeSentAt: null, activatedAt: "2026-10-08T09:05:00Z" }).state).toBe("active");
  });
});
