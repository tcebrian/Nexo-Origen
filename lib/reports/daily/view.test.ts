import { describe, expect, it, vi } from "vitest";
import { parseWhatsAppWebhook } from "@/lib/conversations/channels/whatsapp-cloud/parse-webhook";
import {
  REPORT_NOT_FOUND_REPLY,
  REPORT_NO_ACCESS_REPLY,
  handleInboundAction,
  type InboundActivationRepository,
} from "@/lib/conversations/inbound-actions";
import type { InboundMessage } from "@/lib/conversations/types";
import { slotForDate } from "./calendar";
import { buildSnapshot, type DailyReportSnapshot } from "./snapshot";
import { FALLBACK_WINDOW_HOURS, viewDailyReport, type DailyReportViewDeps, type InformeEnvio } from "./view";

const NOW = new Date("2026-10-23T10:00:00Z"); // jueves

function snapshot(slotDate: string, reviewsA: number): DailyReportSnapshot {
  return buildSnapshot({
    slot: slotForDate(slotDate),
    restaurants: [
      { id: 1, name: "Restaurante A", brand: "BK" },
      { id: 2, name: "Restaurante B", brand: "BK" },
    ],
    metrics: new Map([
      [1, { reviews: reviewsA, ratingSum: reviewsA * 4.5, positive: reviewsA, neutral: 0, negative: 0 }],
      [2, { reviews: 2, ratingSum: 6, positive: 0, neutral: 0, negative: 2 }],
    ]),
    reasons: new Map([[2, "Tiempo de espera"]]),
  });
}

const envio = (over: Partial<InformeEnvio> & { id: string }): InformeEnvio => ({
  contactoId: "c-ana",
  slotDate: "2026-10-20",
  snapshot: snapshot("2026-10-20", 8),
  sentAt: "2026-10-20T07:01:00Z",
  ...over,
});

function setup(over: { byWamid?: Record<string, InformeEnvio>; latest?: InformeEnvio | null; access?: number[] } = {}) {
  const viewed: { id: string; fallback: boolean; count: boolean }[] = [];
  const latestCalls: string[] = [];
  const deps: DailyReportViewDeps = {
    now: () => NOW,
    async findByWamid(wamid) {
      return over.byWamid?.[wamid] ?? null;
    },
    async findLatestForContact(_contactId, sinceIso) {
      latestCalls.push(sinceIso);
      return over.latest ?? null;
    },
    async markViewed(id, input) {
      viewed.push({ id, ...input });
    },
    async resolveRestaurantIds() {
      return over.access ?? [1, 2];
    },
  };
  return { deps, viewed, latestCalls };
}

describe("Ver informe: el snapshot del aviso pulsado", () => {
  it("el jueves, un aviso del martes devuelve el informe DEL MARTES, no el actual", async () => {
    const tuesday = envio({ id: "e-tue", slotDate: "2026-10-20", snapshot: snapshot("2026-10-20", 8) });
    const wednesday = envio({ id: "e-wed", slotDate: "2026-10-21", snapshot: snapshot("2026-10-21", 15) });
    const t = setup({ byWamid: { "wamid.TUE": tuesday, "wamid.WED": wednesday }, latest: wednesday });

    const result = await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, t.deps);
    expect(result).toMatchObject({ status: "report", fallback: false, envioId: "e-tue" });
    if (result.status !== "report") throw new Error("esperaba informe");
    const text = result.messages.join("\n");
    expect(text).toContain("Actualizado: martes 20 de octubre · 09:00");
    expect(text).toContain("Restaurante A · 4,50 · 8 reseñas");
    expect(text).not.toContain("15 reseñas");
    // Con wamid no se busca ningún respaldo.
    expect(t.latestCalls).toHaveLength(0);
  });

  it("nada se recalcula: el resultado es idéntico por mucho que pase el tiempo", async () => {
    const t = setup({ byWamid: { "wamid.TUE": envio({ id: "e-tue" }) } });
    const first = await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, t.deps);
    const later = await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, { ...t.deps, now: () => new Date("2026-11-30T10:00:00Z") });
    expect(later).toEqual(first);
  });

  it("registra la visualización; una reentrega del webhook no cuenta otra vez", async () => {
    const t = setup({ byWamid: { "wamid.TUE": envio({ id: "e-tue" }) } });
    await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, t.deps);
    await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: true }, t.deps);
    expect(t.viewed).toEqual([
      { id: "e-tue", fallback: false, count: true },
      { id: "e-tue", fallback: false, count: false },
    ]);
  });
});

describe("respaldo sin context.id", () => {
  it("usa el último informe del contacto dentro de la ventana segura y registra que fue respaldo", async () => {
    const t = setup({ latest: envio({ id: "e-last" }) });
    const result = await viewDailyReport({ contactId: "c-ana", replyToWamid: null, redelivery: false }, t.deps);
    expect(result).toMatchObject({ status: "report", fallback: true, envioId: "e-last" });
    expect(t.viewed).toEqual([{ id: "e-last", fallback: true, count: true }]);
    const since = new Date(t.latestCalls[0]!).getTime();
    expect(NOW.getTime() - since).toBe(FALLBACK_WINDOW_HOURS * 3_600_000);
  });

  it("un wamid desconocido también cae al respaldo", async () => {
    const t = setup({ latest: envio({ id: "e-last" }) });
    const result = await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.NOPE", redelivery: false }, t.deps);
    expect(result).toMatchObject({ status: "report", fallback: true });
  });

  it("el wamid de OTRO contacto jamás se sirve: se ignora y se aplica el respaldo propio", async () => {
    const foreign = envio({ id: "e-foreign", contactoId: "c-otro" });
    const t = setup({ byWamid: { "wamid.X": foreign }, latest: null });
    expect(await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.X", redelivery: false }, t.deps)).toEqual({ status: "not_found" });
    expect(t.viewed).toHaveLength(0);
  });

  it("sin ningún informe reciente → not_found", async () => {
    const t = setup();
    expect(await viewDailyReport({ contactId: "c-ana", replyToWamid: null, redelivery: false }, t.deps)).toEqual({ status: "not_found" });
  });
});

describe("permisos al pulsar (deny by default)", () => {
  it("sin ningún restaurante accesible no se muestra nada", async () => {
    const t = setup({ byWamid: { "wamid.TUE": envio({ id: "e-tue" }) }, access: [] });
    expect(await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, t.deps)).toEqual({ status: "no_access" });
    expect(t.viewed).toHaveLength(0);
  });

  it("un restaurante retirado desde el envío deja de mostrarse; el resto sale del snapshot", async () => {
    const t = setup({ byWamid: { "wamid.TUE": envio({ id: "e-tue" }) }, access: [1] });
    const result = await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, t.deps);
    if (result.status !== "report") throw new Error("esperaba informe");
    const text = result.messages.join("\n");
    expect(text).toContain("Restaurante A");
    expect(text).not.toContain("Restaurante B");
  });

  it("un snapshot ilegible no se renderiza", async () => {
    const t = setup({ byWamid: { "wamid.TUE": envio({ id: "e-tue", snapshot: { roto: true } }) } });
    expect(await viewDailyReport({ contactId: "c-ana", replyToWamid: "wamid.TUE", redelivery: false }, t.deps)).toEqual({ status: "not_found" });
  });
});

describe("context.id del webhook de WhatsApp", () => {
  const webhook = (message: Record<string, unknown>) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "100000000000001" },
              messages: [{ from: "34600000001", id: "wamid.CLICK", timestamp: "1760000000", ...message }],
            },
          },
        ],
      },
    ],
  });

  it("lee el wamid de la plantilla a la que responde el botón", () => {
    const [message] = parseWhatsAppWebhook(
      webhook({ type: "button", button: { payload: "Ver informe", text: "Ver informe" }, context: { from: "34688718820", id: "wamid.TEMPLATE" } })
    ).messages;
    expect(message).toMatchObject({ text: "Ver informe", replyToExternalId: "wamid.TEMPLATE" });
  });

  it("sin context no hay replyToExternalId", () => {
    const [message] = parseWhatsAppWebhook(webhook({ type: "button", button: { payload: "Ver informe", text: "Ver informe" } })).messages;
    expect(message!.replyToExternalId).toBeUndefined();
  });
});

describe("acción VIEW_DAILY_REPORT", () => {
  const message = (over: Partial<InboundMessage> = {}): InboundMessage => ({
    externalMessageId: "wamid.CLICK",
    channelExternalId: "100000000000001",
    senderPhone: "+34600000001",
    contentType: "text",
    text: "Ver informe",
    interactive: { title: "Ver informe" },
    replyToExternalId: "wamid.TEMPLATE",
    providerTimestamp: new Date("2026-10-23T10:00:00Z"),
    ...over,
  });
  const activations: InboundActivationRepository = {
    isActivated: async () => true,
    markActivated: async () => false,
  };

  function run(view: ReturnType<typeof vi.fn>, over: Partial<InboundMessage> = {}) {
    const replies: { requestId: string; text: string }[] = [];
    return {
      replies,
      done: handleInboundAction(
        { message: message(over), contactId: "c-ana", conversationId: "conv-1", redelivery: false },
        {
          activations,
          viewDailyReport: view as never,
          sendReply: async ({ requestId, text }) => void replies.push({ requestId, text }),
        }
      ),
    };
  }

  it("envía los mensajes del informe en orden, cada uno con su id derivado", async () => {
    const view = vi.fn(async () => ({ status: "report", messages: ["parte 1", "parte 2", "parte 3"], fallback: false, envioId: "e1" }));
    const t = run(view);
    expect(await t.done).toEqual({ action: "VIEW_DAILY_REPORT" });
    expect(t.replies.map((reply) => reply.text)).toEqual(["parte 1", "parte 2", "parte 3"]);
    expect(new Set(t.replies.map((reply) => reply.requestId)).size).toBe(3);
    // El wamid de la plantilla viaja hasta la búsqueda del informe.
    expect(view).toHaveBeenCalledWith({ contactId: "c-ana", replyToWamid: "wamid.TEMPLATE", redelivery: false });
  });

  it("sin informe o sin acceso responde un texto breve, nunca datos", async () => {
    const none = run(vi.fn(async () => ({ status: "not_found" })));
    await none.done;
    expect(none.replies.map((reply) => reply.text)).toEqual([REPORT_NOT_FOUND_REPLY]);

    const denied = run(vi.fn(async () => ({ status: "no_access" })));
    await denied.done;
    expect(denied.replies.map((reply) => reply.text)).toEqual([REPORT_NO_ACCESS_REPLY]);
  });

  it("una reentrega del webhook reutiliza los mismos ids (no duplica mensajes)", async () => {
    const view = vi.fn(async () => ({ status: "report", messages: ["a", "b"], fallback: false, envioId: "e1" }));
    const first = run(view);
    const second = run(view);
    await Promise.all([first.done, second.done]);
    expect(first.replies.map((reply) => reply.requestId)).toEqual(second.replies.map((reply) => reply.requestId));
  });
});
