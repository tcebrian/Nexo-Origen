import { describe, expect, it, vi } from "vitest";
import {
  MANUAL_RESEND_FAILED_PREFIX,
  resendAlertManually,
  type AlertPatch,
  type DeliverResult,
  type ManualResendAlert,
  type ManualResendContact,
  type ManualResendDeps,
  type TemplateResult,
} from "./orchestrator";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const ALERT: ManualResendAlert = { id: "a1", resenaId: 77, restauranteId: 5, contactId: "c1", status: "pending" };
const CONTACT: ManualResendContact = { name: "Tomás", activated: true, alertsEnabled: true };
const REVIEW = { resenaId: 77, restauranteId: 5, stars: 1, restaurantName: "BK Soria" };

function setup(overrides: {
  alert?: ManualResendAlert | null;
  contact?: ManualResendContact | null;
  access?: number[];
  claim?: boolean;
  windowOpen?: boolean;
  deliver?: DeliverResult;
  notifiedTemplate?: boolean;
  template?: TemplateResult;
  review?: typeof REVIEW | null;
} = {}) {
  const updates: AlertPatch[] = [];
  const deliverContent = vi.fn(async () => overrides.deliver ?? ({ status: "sent" } as DeliverResult));
  const sendTemplate = vi.fn(async () => overrides.template ?? ({ status: "sent", wamid: "wamid.T" } as TemplateResult));
  const claim = vi.fn(async () => overrides.claim ?? true);
  const deps: ManualResendDeps = {
    now: () => NOW,
    loadAlert: async () => (overrides.alert === undefined ? ALERT : overrides.alert),
    loadContact: async () => (overrides.contact === undefined ? CONTACT : overrides.contact),
    resolveRestaurantIds: async () => overrides.access ?? [5],
    claim,
    loadReview: async () => (overrides.review === undefined ? REVIEW : overrides.review),
    update: async (_id, patch) => {
      updates.push(patch);
    },
    conversationFor: async () => "conv-1",
    isWindowOpen: async () => overrides.windowOpen ?? true,
    deliverContent,
    hasNotifiedTemplate: async () => overrides.notifiedTemplate ?? false,
    countOutstanding: async () => 2,
    sendTemplate,
  };
  return { deps, updates, deliverContent, sendTemplate, claim };
}

describe("resendAlertManually", () => {
  it("ventana abierta: reenvía imagen + texto con la MISMA semilla de la alerta y la marca entregada", async () => {
    const { deps, updates, deliverContent } = setup();
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "delivered" });
    expect(deliverContent).toHaveBeenCalledWith(expect.objectContaining({ requestSeed: "negalert:77:c1:a1", conversationId: "conv-1" }));
    expect(updates.at(-1)).toMatchObject({ status: "delivered", via: "direct", errorCode: null, errorReason: null });
  });

  it("ventana cerrada: manda la plantilla «Ver alerta»", async () => {
    const { deps, updates, deliverContent, sendTemplate } = setup({ windowOpen: false });
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "template_sent" });
    expect(deliverContent).not.toHaveBeenCalled();
    expect(sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ count: 2, contactName: "Tomás" }));
    expect(updates.at(-1)).toMatchObject({ status: "notified", via: "template", templateWamid: "wamid.T" });
  });

  it("ventana cerrada con un aviso sin atender: no manda otra plantilla", async () => {
    const { deps, updates, sendTemplate } = setup({ windowOpen: false, notifiedTemplate: true });
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "waiting_template" });
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ status: "pending", errorReason: "waiting_template" });
  });

  it("Meta confirma ventana cerrada (131047): cae a plantilla", async () => {
    const { deps, sendTemplate } = setup({ deliver: { status: "rejected", code: "131047" } });
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "template_sent" });
    expect(sendTemplate).toHaveBeenCalled();
  });

  it("si vuelve a fallar la imagen, queda pendiente con el motivo y la marca del reenvío manual", async () => {
    const { deps, updates, sendTemplate } = setup({ deliver: { status: "rejected", code: "image:RenderError:504" } });
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "failed", code: "image:RenderError:504", uncertain: false });
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ status: "pending", errorCode: "image:RenderError:504" });
    expect(updates.at(-1)?.errorReason).toMatch(new RegExp(`^${MANUAL_RESEND_FAILED_PREFIX}`));
  });

  it("envío incierto: queda fallida y avisa (no se reenvía a ciegas)", async () => {
    const { deps, updates } = setup({ deliver: { status: "uncertain", code: "unconfirmed" } });
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "failed", code: "unconfirmed", uncertain: true });
    expect(updates.at(-1)).toMatchObject({ status: "failed", errorReason: "uncertain" });
  });

  it("deny by default: sin acceso hoy al restaurante no se envía nada", async () => {
    const { deps, claim, deliverContent } = setup({ access: [9] });
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "no_access" });
    expect(claim).not.toHaveBeenCalled();
    expect(deliverContent).not.toHaveBeenCalled();
  });

  it("respeta el interruptor de alertas y la activación de WhatsApp", async () => {
    expect(await resendAlertManually({ alertId: "a1" }, setup({ contact: { ...CONTACT, alertsEnabled: false } }).deps)).toEqual({
      status: "alerts_disabled",
    });
    expect(await resendAlertManually({ alertId: "a1" }, setup({ contact: { ...CONTACT, activated: false } }).deps)).toEqual({
      status: "not_activated",
    });
  });

  it("solo alertas sin entregar; otra pulsación simultánea no envía dos veces", async () => {
    expect(await resendAlertManually({ alertId: "a1" }, setup({ alert: { ...ALERT, status: "delivered" } }).deps)).toEqual({
      status: "not_resendable",
      current: "delivered",
    });
    const busy = setup({ claim: false });
    expect(await resendAlertManually({ alertId: "a1" }, busy.deps)).toEqual({ status: "busy" });
    expect(busy.deliverContent).not.toHaveBeenCalled();
    expect(await resendAlertManually({ alertId: "a1" }, setup({ alert: null }).deps)).toEqual({ status: "not_found" });
  });

  it("un error inesperado nunca deja la alerta en `delivering`", async () => {
    const { deps, updates } = setup();
    deps.conversationFor = async () => {
      throw new TypeError("boom");
    };
    expect(await resendAlertManually({ alertId: "a1" }, deps)).toEqual({ status: "failed", code: "exception", uncertain: false });
    expect(updates.at(-1)).toMatchObject({ status: "pending", errorCode: "exception", errorReason: `${MANUAL_RESEND_FAILED_PREFIX}TypeError` });
  });
});
