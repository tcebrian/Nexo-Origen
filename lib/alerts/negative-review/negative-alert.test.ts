import { describe, expect, it, vi } from "vitest";
import { handleInboundAction, ALERTS_NONE_REPLY, ALERTS_NO_ACCESS_REPLY, ALERTS_FAILED_REPLY } from "@/lib/conversations/inbound-actions";
import type { InboundMessage } from "@/lib/conversations/types";
import { alertImagePreview, buildAlertText } from "./message";
import { isReviewUrl, resolveMapsLink } from "./maps-link";
import {
  ALERTS_PER_VIEW,
  NEGATIVE_ALERT_MAX_STARS,
  deliverPendingAlerts,
  processNegativeReviewAlert,
  type AlertPatch,
  type AlertRecipient,
  type AlertReview,
  type DeliverResult,
  type NegativeAlertDeps,
  type OutstandingAlert,
  type PendingAlertsDeps,
  type PendingAlertsResult,
} from "./orchestrator";

const REVIEW: AlertReview = { resenaId: 501, restauranteId: 7, stars: 1, restaurantName: "Burger King Utebo" };
const NOW = new Date("2026-10-13T10:00:00.000Z");

describe("enlace de Google Maps", () => {
  const contrib = "https://www.google.com/maps/contrib/114286234345303994636?hl=es";
  const review = "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sChdDSUhNMG9nS0VJQ0FnSURkMDVTLXlBRRAB";

  it("1) la URL exacta de la reseña, si es de una reseña", () => {
    expect(resolveMapsLink({ reviewUrl: review, restaurantMapsUrl: "https://maps.app.goo.gl/abc", placeId: "ChIJx" })).toEqual({
      url: review,
      source: "review_url",
    });
    expect(isReviewUrl(review)).toBe(true);
  });

  it("el perfil del autor (/maps/contrib/) NUNCA se usa como enlace de la reseña", () => {
    expect(isReviewUrl(contrib)).toBe(false);
    const link = resolveMapsLink({ reviewUrl: contrib, placeId: "ChIJabc" });
    expect(link?.source).toBe("place_id");
    expect(link?.url).not.toContain("contrib");
  });

  it("2) google_maps_url del restaurante; 3) place_id; cid; respaldo por búsqueda", () => {
    expect(resolveMapsLink({ restaurantMapsUrl: "https://maps.app.goo.gl/abc", placeId: "ChIJx" })).toEqual({
      url: "https://maps.app.goo.gl/abc",
      source: "google_maps_url",
    });
    expect(resolveMapsLink({ placeId: "ChIJJc9dFAwpQg0RZ16au7Pi5dk" })).toEqual({
      url: "https://www.google.com/maps/search/?api=1&query=Google&query_place_id=ChIJJc9dFAwpQg0RZ16au7Pi5dk",
      source: "place_id",
    });
    expect(resolveMapsLink({ cid: "12345678901234567890" })).toEqual({ url: "https://www.google.com/maps?cid=12345678901234567890", source: "cid" });
    expect(resolveMapsLink({ name: "BK Utebo", address: "Calle Mayor 1", city: "Utebo" })?.source).toBe("search");
    expect(resolveMapsLink({})).toBeNull();
  });

  it("solo https y dominios de Google: nada de javascript:, http ni dominios ajenos", () => {
    for (const bad of ["javascript:alert(1)", "http://www.google.com/maps/reviews/x", "https://evil.example/maps/reviews/x", "ftp://x"]) {
      expect(resolveMapsLink({ reviewUrl: bad, restaurantMapsUrl: bad })).toBeNull();
    }
  });
});

describe("texto de la alerta", () => {
  it("restaurante, valoración, aviso y enlace; sin enlace no queda un bloque vacío", () => {
    expect(buildAlertText({ restaurantName: "Burger King Utebo", stars: 1, link: "https://maps.example/x" })).toBe(
      [
        "🚨 Reseña negativa detectada",
        "Restaurante: Burger King Utebo",
        "Valoración: 1★",
        "Te enviamos la captura para revisarla cuanto antes.",
        "",
        "🔗 Ver en Google Maps:",
        "https://maps.example/x",
      ].join("\n")
    );
    expect(buildAlertText({ restaurantName: "BK", stars: 2, link: null })).not.toContain("Google Maps");
    expect(alertImagePreview("BK")).toContain("BK");
  });
});

type SetupOptions = {
  recipients?: AlertRecipient[];
  review?: AlertReview | null;
  windowOpen?: boolean;
  deliver?: DeliverResult;
  template?: { status: "sent"; wamid: string | null } | { status: "failed"; code: string };
  outstanding?: number;
  existing?: string[];
};

function setup(over: SetupOptions = {}) {
  const recipients = over.recipients ?? [{ contactId: "c-1", name: "tomas", activated: true }];
  const rows = new Map<string, { contactId: string; resenaId: number; patches: AlertPatch[]; origin: string }>();
  const existing = new Set(over.existing ?? []);
  let counter = 0;
  const calls: string[] = [];

  const deps: NegativeAlertDeps = {
    now: () => NOW,
    loadReview: vi.fn(async () => (over.review === undefined ? REVIEW : over.review)),
    findRecipients: vi.fn(async () => recipients),
    async reserve({ contactId, resenaId, origin }) {
      if (existing.has(contactId)) return null;
      const id = `alert-${++counter}`;
      rows.set(id, { contactId, resenaId, patches: [], origin });
      return { id };
    },
    async update(id, patch) {
      rows.get(id)!.patches.push(patch);
    },
    conversationFor: vi.fn(async (contactId: string) => `conv-${contactId}`),
    isWindowOpen: vi.fn(async () => over.windowOpen ?? false),
    countOutstanding: vi.fn(async () => over.outstanding ?? 1),
    deliverContent: vi.fn(async () => {
      calls.push("content");
      return over.deliver ?? ({ status: "sent" } as const);
    }),
    sendTemplate: vi.fn(async () => {
      calls.push("template");
      return over.template ?? ({ status: "sent", wamid: "wamid.ALERT" } as const);
    }),
  };
  return { deps, rows, calls };
}

const lastStatus = (row: { patches: AlertPatch[] }) => [...row.patches].reverse().find((patch) => patch.status)?.status;

describe("alerta negativa: ventana, activación y permisos", () => {
  it("CASO 1 · activado con ventana abierta: imagen + texto directos, sin plantilla", async () => {
    const t = setup({ windowOpen: true });
    const result = await processNegativeReviewAlert({ resenaId: 501 }, t.deps);
    expect(result).toMatchObject({ status: "processed", outcomes: [{ contactId: "c-1", outcome: "delivered_direct" }] });
    expect(t.calls).toEqual(["content"]);
    expect(t.deps.sendTemplate).not.toHaveBeenCalled();
    const row = t.rows.get("alert-1")!;
    expect(lastStatus(row)).toBe("delivered");
    expect(row.patches.some((patch) => patch.via === "direct")).toBe(true);
  });

  it("CASO 2 · activado con ventana cerrada: solo plantilla (nada de imagen ni texto libre) y queda 'notified'", async () => {
    const t = setup({ windowOpen: false, outstanding: 3 });
    const result = await processNegativeReviewAlert({ resenaId: 501 }, t.deps);
    expect(result).toMatchObject({ outcomes: [{ outcome: "template_sent" }] });
    expect(t.calls).toEqual(["template"]);
    expect(t.deps.deliverContent).not.toHaveBeenCalled();
    expect(t.deps.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ contactName: "tomas", count: 3 }));
    const row = t.rows.get("alert-1")!;
    expect(lastStatus(row)).toBe("notified");
    expect(row.patches.find((patch) => patch.templateWamid)?.templateWamid).toBe("wamid.ALERT");
  });

  it("CASO 3 · no activado: pendiente, sin enviar nada (ni plantilla ni contenido ni ventana)", async () => {
    const t = setup({ recipients: [{ contactId: "c-1", name: null, activated: false }], windowOpen: true });
    const result = await processNegativeReviewAlert({ resenaId: 501 }, t.deps);
    expect(result).toMatchObject({ outcomes: [{ outcome: "pending_not_activated" }] });
    expect(t.calls).toEqual([]);
    expect(t.deps.conversationFor).not.toHaveBeenCalled();
    expect(lastStatus(t.rows.get("alert-1")!)).toBe("pending");
  });

  it("deny by default: sin destinatarios con acceso no se reserva ni envía nada", async () => {
    const t = setup({ recipients: [] });
    expect(await processNegativeReviewAlert({ resenaId: 501 }, t.deps)).toMatchObject({ status: "processed", recipients: 0, outcomes: [] });
    expect(t.rows.size).toBe(0);
    expect(t.calls).toEqual([]);
  });

  it("idempotente: un reintento del webhook no vuelve a enviar a quien ya tiene la alerta", async () => {
    const t = setup({ existing: ["c-1"], windowOpen: true });
    expect(await processNegativeReviewAlert({ resenaId: 501 }, t.deps)).toMatchObject({ outcomes: [{ outcome: "already_processed" }] });
    expect(t.calls).toEqual([]);
  });

  it.each([1, 2, 3])("%i★ genera alerta", async (stars) => {
    const t = setup({ review: { ...REVIEW, stars }, windowOpen: true });
    const result = await processNegativeReviewAlert({ resenaId: 1 }, t.deps);
    expect(result).toMatchObject({ status: "processed", outcomes: [{ outcome: "delivered_direct" }] });
    expect(t.calls).toEqual(["content"]);
  });

  it.each([4, 5])("%i★ no genera alerta: no se reserva ni se envía nada", async (stars) => {
    const t = setup({ review: { ...REVIEW, stars }, windowOpen: true });
    expect(await processNegativeReviewAlert({ resenaId: 1 }, t.deps)).toEqual({ status: "skipped", reason: "not_negative" });
    expect(t.rows.size).toBe(0);
    expect(t.calls).toEqual([]);
    expect(t.deps.findRecipients).not.toHaveBeenCalled();
  });

  it("estrellas fuera de rango (0, null, 6) tampoco alertan; reseña inexistente se ignora", async () => {
    for (const stars of [0, -1, 6, Number.NaN]) {
      expect(await processNegativeReviewAlert({ resenaId: 1 }, setup({ review: { ...REVIEW, stars } }).deps)).toEqual({ status: "skipped", reason: "not_negative" });
    }
    expect(await processNegativeReviewAlert({ resenaId: 1 }, setup({ review: null }).deps)).toEqual({ status: "skipped", reason: "review_not_found" });
  });

  it("la regla alertable es estrellas ≤ 3", () => {
    expect(NEGATIVE_ALERT_MAX_STARS).toBe(3);
  });

  it("varios contactos: cada uno según su estado; el fallo de uno no frena a los demás", async () => {
    const t = setup({
      recipients: [
        { contactId: "c-1", name: "a", activated: true },
        { contactId: "c-2", name: "b", activated: false },
        { contactId: "c-3", name: "c", activated: true },
      ],
      windowOpen: true,
    });
    vi.mocked(t.deps.deliverContent).mockRejectedValueOnce(new Error("boom"));
    const result = await processNegativeReviewAlert({ resenaId: 501 }, t.deps);
    expect(result.status === "processed" && result.outcomes.map((o) => o.outcome)).toEqual(["failed", "pending_not_activated", "delivered_direct"]);
  });

  it("directo rechazado (ventana recién cerrada) → plantilla; incierto → no se cae a plantilla", async () => {
    const rejected = setup({ windowOpen: true, deliver: { status: "rejected", code: "131047" } });
    expect(await processNegativeReviewAlert({ resenaId: 501 }, rejected.deps)).toMatchObject({ outcomes: [{ outcome: "template_sent" }] });
    expect(rejected.calls).toEqual(["content", "template"]);

    const uncertain = setup({ windowOpen: true, deliver: { status: "uncertain", code: "unconfirmed" } });
    expect(await processNegativeReviewAlert({ resenaId: 501 }, uncertain.deps)).toMatchObject({ outcomes: [{ outcome: "failed" }] });
    expect(uncertain.calls).toEqual(["content"]);
  });

  it("plantilla rechazada: la alerta sigue pendiente para 'Ver alerta'", async () => {
    const t = setup({ template: { status: "failed", code: "132001" } });
    expect(await processNegativeReviewAlert({ resenaId: 501 }, t.deps)).toMatchObject({ outcomes: [{ outcome: "pending_template_failed" }] });
    expect(lastStatus(t.rows.get("alert-1")!)).toBe("pending");
  });

  it("prueba manual: solo al contacto indicado y forzando plantilla aunque la ventana esté abierta", async () => {
    const t = setup({
      recipients: [
        { contactId: "c-1", name: "a", activated: true },
        { contactId: "c-2", name: "b", activated: true },
      ],
      windowOpen: true,
    });
    const result = await processNegativeReviewAlert({ resenaId: 501, origin: "prueba", onlyContactId: "c-2", forceTemplate: true }, t.deps);
    expect(result).toMatchObject({ recipients: 1, outcomes: [{ contactId: "c-2", outcome: "template_sent" }] });
    expect(t.deps.isWindowOpen).not.toHaveBeenCalled();
    expect(t.rows.get("alert-1")!.origin).toBe("prueba");
  });
});

describe("'Ver alerta': entrega del contenido real", () => {
  function pendingSetup(over: { access?: number[]; outstanding?: OutstandingAlert[]; deliver?: DeliverResult; claim?: boolean } = {}) {
    const patches: { id: string; patch: AlertPatch }[] = [];
    const deps: PendingAlertsDeps = {
      now: () => NOW,
      resolveRestaurantIds: vi.fn(async () => over.access ?? [7]),
      listOutstanding: vi.fn(async () => over.outstanding ?? [{ id: "a-1", resenaId: 501, restauranteId: 7 }]),
      claim: vi.fn(async () => over.claim ?? true),
      loadReview: vi.fn(async () => REVIEW),
      update: vi.fn(async (id: string, patch: AlertPatch) => {
        patches.push({ id, patch });
      }),
      deliverContent: vi.fn(async () => over.deliver ?? ({ status: "sent" } as const)),
    };
    return { deps, patches };
  }

  it("entrega imagen + texto de las alertas pendientes y las marca como entregadas", async () => {
    const t = pendingSetup();
    expect(await deliverPendingAlerts({ contactId: "c-1", conversationId: "conv-1" }, t.deps)).toEqual({ status: "delivered", delivered: 1, failed: 0, remaining: 0 });
    expect(t.deps.deliverContent).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-1", contactId: "c-1", review: REVIEW }));
    expect(t.patches.at(-1)!.patch).toMatchObject({ status: "delivered" });
  });

  it("permisos de HOY: una alerta de un restaurante retirado no se entrega", async () => {
    const t = pendingSetup({ access: [99] });
    expect(await deliverPendingAlerts({ contactId: "c-1", conversationId: "conv-1" }, t.deps)).toEqual({ status: "none" });
    expect(t.deps.deliverContent).not.toHaveBeenCalled();
    expect(await deliverPendingAlerts({ contactId: "c-1", conversationId: "conv-1" }, pendingSetup({ access: [] }).deps)).toEqual({ status: "no_access" });
  });

  it("doble pulsación: si otra ya tomó la alerta no se envía otra vez", async () => {
    const t = pendingSetup({ claim: false });
    expect(await deliverPendingAlerts({ contactId: "c-1", conversationId: "conv-1" }, t.deps)).toMatchObject({ delivered: 0, failed: 0 });
    expect(t.deps.deliverContent).not.toHaveBeenCalled();
  });

  it("si falla vuelve a la cola; el máximo por pulsación deja el resto pendiente", async () => {
    const failed = pendingSetup({ deliver: { status: "rejected", code: "131047" } });
    expect(await deliverPendingAlerts({ contactId: "c-1", conversationId: "conv-1" }, failed.deps)).toMatchObject({ delivered: 0, failed: 1 });
    expect(failed.patches.at(-1)!.patch).toMatchObject({ status: "pending", errorCode: "131047" });

    const many = pendingSetup({
      outstanding: Array.from({ length: ALERTS_PER_VIEW + 3 }, (_, index) => ({ id: `a-${index}`, resenaId: 600 + index, restauranteId: 7 })),
    });
    expect(await deliverPendingAlerts({ contactId: "c-1", conversationId: "conv-1" }, many.deps)).toEqual({
      status: "delivered",
      delivered: ALERTS_PER_VIEW,
      failed: 0,
      remaining: 3,
    });
  });
});

describe("botón 'Ver alerta' en el webhook entrante", () => {
  const message = (): InboundMessage =>
    ({
      externalMessageId: "wamid.IN1",
      from: "34600111222",
      contentType: "text",
      text: "Ver alerta",
      interactive: { title: "Ver alerta" },
    }) as unknown as InboundMessage;

  function run(result: PendingAlertsResult, redelivery = false) {
    const replies: string[] = [];
    const viewPendingAlerts = vi.fn(async () => result);
    return {
      replies,
      viewPendingAlerts,
      done: handleInboundAction(
        { message: message(), contactId: "c-1", conversationId: "conv-1", redelivery },
        {
          activations: { isActivated: async () => true, markActivated: async () => false },
          sendReply: async ({ text }) => {
            replies.push(text);
          },
          viewPendingAlerts,
        }
      ),
    };
  }

  it("resuelve VIEW_PENDING_ALERTS con el contacto y la conversación, y no repite lo que ya envió la entrega", async () => {
    const ok = run({ status: "delivered", delivered: 2, failed: 0, remaining: 0 });
    expect(await ok.done).toEqual({ action: "VIEW_PENDING_ALERTS" });
    expect(ok.viewPendingAlerts).toHaveBeenCalledWith({ contactId: "c-1", conversationId: "conv-1" });
    expect(ok.replies).toEqual([]);
  });

  it("sin alertas / sin acceso / fallo → respuesta corta; en reentrega 'sin alertas' no responde", async () => {
    const none = run({ status: "none" });
    await none.done;
    expect(none.replies).toEqual([ALERTS_NONE_REPLY]);

    const again = run({ status: "none" }, true);
    await again.done;
    expect(again.replies).toEqual([]);

    const noAccess = run({ status: "no_access" });
    await noAccess.done;
    expect(noAccess.replies).toEqual([ALERTS_NO_ACCESS_REPLY]);

    const failed = run({ status: "delivered", delivered: 0, failed: 1, remaining: 0 });
    await failed.done;
    expect(failed.replies).toEqual([ALERTS_FAILED_REPLY]);
  });
});
