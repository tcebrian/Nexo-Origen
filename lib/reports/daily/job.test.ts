import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailySlot } from "./calendar";
import { runDailyReport, type DailyReportJobDeps, type SendResult } from "./job";
import type { DailyReportSnapshot } from "./snapshot";

// 21 oct 2026, 09:05 en Madrid (CEST = UTC+2) → slot de las 09:00, semana en curso.
const NOW = new Date("2026-10-21T07:05:00Z");

type Envio = { id: string; contactId: string; slotDate: string; template: string; status: string; snapshot?: DailyReportSnapshot; code?: string };

function setup(
  over: {
    contacts?: { id: string; name: string | null }[];
    access?: Record<string, number[]>;
    send?: (input: { contactId: string }) => Promise<SendResult>;
    existing?: Envio[];
    now?: Date;
    budgetMs?: number;
  } = {}
) {
  const envios: Envio[] = [...(over.existing ?? [])];
  const contacts = over.contacts ?? [
    { id: "c-ana", name: "Ana" },
    { id: "c-ben", name: "Ben" },
    { id: "c-sin-acceso", name: "Sin acceso" },
  ];
  const access = over.access ?? { "c-ana": [1, 2], "c-ben": [2], "c-sin-acceso": [] };
  const sends: { contactId: string; slotDate: string; requestSeed: string; label: string }[] = [];
  const loadCalls: { ids: number[]; slot: DailySlot }[] = [];
  let seq = 0;

  const deps: DailyReportJobDeps = {
    now: () => over.now ?? NOW,
    budgetMs: over.budgetMs,
    async listActivatedContacts() {
      return contacts;
    },
    async resolveRestaurantIds(ids) {
      return new Map(ids.map((id) => [id, access[id] ?? []]));
    },
    async listContactsWithEnvio(slotDate) {
      return new Set(envios.filter((envio) => envio.slotDate === slotDate && envio.template === "informe_diario").map((envio) => envio.contactId));
    },
    async loadWindowData(ids, slot) {
      loadCalls.push({ ids, slot });
      return {
        restaurants: new Map(ids.map((id) => [id, { id, name: `Restaurante ${id}`, brand: "BK" }])),
        // El restaurante 1 tiene reseñas; el 2 no tiene ninguna (0 reseñas es válido).
        metrics: new Map([[1, { reviews: 3, ratingSum: 13, positive: 2, neutral: 1, negative: 0 }]]),
        reasons: new Map(),
      };
    },
    async reserve({ contactId, slot, template }) {
      if (envios.some((envio) => envio.contactId === contactId && envio.slotDate === slot.slotDate && envio.template === template)) return null;
      const envio: Envio = { id: `e-${++seq}`, contactId, slotDate: slot.slotDate, template, status: "reserved" };
      envios.push(envio);
      return { id: envio.id };
    },
    async saveSnapshot(id, snapshot) {
      envios.find((envio) => envio.id === id)!.snapshot = snapshot;
    },
    async send(input) {
      sends.push({ contactId: input.contactId, slotDate: input.slot.slotDate, requestSeed: input.requestSeed, label: input.slot.templateLabel });
      return (over.send ?? (async () => ({ status: "sent", messageId: `m-${input.contactId}`, wamid: `wamid.${input.contactId}`, conversationId: "conv" })))(input);
    },
    async markSent(id) {
      envios.find((envio) => envio.id === id)!.status = "sent";
    },
    async markFailed(id, result) {
      const envio = envios.find((item) => item.id === id)!;
      envio.status = "failed";
      envio.code = result.code;
    },
  };
  return { deps, envios, sends, loadCalls };
}

beforeEach(() => vi.clearAllMocks());

describe("quién recibe el informe", () => {
  it("solo contactos activos con al menos un restaurante accesible; los demás no", async () => {
    const t = setup();
    const result = await runDailyReport(t.deps);
    expect(result).toMatchObject({ status: "ran", activated: 3, eligible: 2, sent: 2, failed: 0 });
    expect(t.sends.map((send) => send.contactId).sort()).toEqual(["c-ana", "c-ben"]);
    expect(t.envios.map((envio) => envio.contactId)).not.toContain("c-sin-acceso");
  });

  it("aunque el periodo tenga 0 reseñas SÍ se envía", async () => {
    const t = setup({ contacts: [{ id: "c-ben", name: "Ben" }], access: { "c-ben": [2] } });
    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 1 });
    expect(t.envios[0]!.snapshot!.restaurants[0]).toMatchObject({ id: 2, reviews: 0 });
  });
});

describe("snapshot y permisos", () => {
  it("cada snapshot contiene solo los restaurantes que ese contacto puede ver y usa el slot de las 09:00", async () => {
    const t = setup();
    await runDailyReport(t.deps);
    const ana = t.envios.find((envio) => envio.contactId === "c-ana")!.snapshot!;
    const ben = t.envios.find((envio) => envio.contactId === "c-ben")!.snapshot!;
    expect(ana.restaurants.map((restaurant) => restaurant.id)).toEqual([1, 2]);
    expect(ben.restaurants.map((restaurant) => restaurant.id)).toEqual([2]);
    expect(ana).toMatchObject({
      kind: "WEEK_TO_DATE",
      slotDate: "2026-10-21",
      slotAt: "2026-10-21T09:00:00",
      period: { start: "2026-10-19T00:00:00", end: "2026-10-21T09:00:00" },
    });
  });

  it("las métricas se calculan una vez para la unión de restaurantes, con la ventana del slot", async () => {
    const t = setup();
    await runDailyReport(t.deps);
    expect(t.loadCalls).toHaveLength(1);
    expect(t.loadCalls[0]!.ids.sort()).toEqual([1, 2]);
    expect(t.loadCalls[0]!.slot).toMatchObject({ periodStart: "2026-10-19T00:00:00", periodEnd: "2026-10-21T09:00:00" });
  });

  it("el snapshot usa el slot aunque la ejecución llegue tarde (10:40) y no la hora real", async () => {
    const t = setup({ now: new Date("2026-10-21T08:40:00Z") });
    await runDailyReport(t.deps);
    expect(t.envios[0]!.snapshot!.slotAt).toBe("2026-10-21T09:00:00");
    expect(t.envios[0]!.snapshot!.period.end).toBe("2026-10-21T09:00:00");
  });

  it("lunes: cierre semanal con la semana anterior completa", async () => {
    const t = setup({ now: new Date("2026-10-19T07:00:00Z") });
    await runDailyReport(t.deps);
    expect(t.envios[0]!.snapshot).toMatchObject({
      kind: "WEEKLY_CLOSURE",
      period: { start: "2026-10-12T00:00:00", end: "2026-10-19T00:00:00" },
    });
    expect(t.sends[0]!.label).toBe("cierre de la semana del 12 al 18 de octubre");
  });
});

describe("idempotencia", () => {
  it("ejecutar el job dos veces no manda dos plantillas del mismo slot", async () => {
    const t = setup();
    const first = await runDailyReport(t.deps);
    const second = await runDailyReport(t.deps);
    expect(first).toMatchObject({ sent: 2 });
    expect(second).toMatchObject({ sent: 0, alreadyDone: 2 });
    expect(t.sends).toHaveLength(2);
  });

  it("si otra ejecución reservó mientras tanto, esa no envía (pierde la carrera)", async () => {
    const t = setup({ contacts: [{ id: "c-ana", name: "Ana" }], access: { "c-ana": [1] } });
    const reserve = t.deps.reserve;
    t.deps.reserve = async (input) => {
      await reserve(input); // la "otra ejecución" gana
      return reserve(input); // la nuestra, después, encuentra la reserva
    };
    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 0, lostRace: 1 });
    expect(t.sends).toHaveLength(0);
  });

  it("el id de envío es estable por (contacto, día, plantilla)", async () => {
    const t = setup();
    await runDailyReport(t.deps);
    expect(t.sends.find((send) => send.contactId === "c-ana")!.requestSeed).toBe("informe_diario:c-ana:2026-10-21");
  });

  it("un slot de otro día no se confunde con el anterior", async () => {
    const t = setup({ existing: [{ id: "e-old", contactId: "c-ana", slotDate: "2026-10-20", template: "informe_diario", status: "sent" }] });
    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 2, alreadyDone: 0 });
  });
});

describe("fallos", () => {
  it("un fallo se registra y NO se reintenta en bucle (ni en la misma ejecución ni en la siguiente)", async () => {
    const t = setup({
      contacts: [{ id: "c-ana", name: "Ana" }],
      access: { "c-ana": [1] },
      send: async () => ({ status: "failed", code: "132001", reason: "rejected" }),
    });
    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 0, failed: 1 });
    expect(t.envios[0]).toMatchObject({ status: "failed", code: "132001" });

    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 0, failed: 0, alreadyDone: 1 });
    expect(t.sends).toHaveLength(1);
  });

  it("una excepción en un contacto no impide los demás y queda registrada", async () => {
    let calls = 0;
    const t = setup({
      send: async (input) => {
        calls++;
        if (input.contactId === "c-ana") throw new Error("boom");
        return { status: "sent", messageId: "m", wamid: "w", conversationId: "c" };
      },
    });
    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 1, failed: 1 });
    expect(calls).toBe(2);
    expect(t.envios.find((envio) => envio.contactId === "c-ana")).toMatchObject({ status: "failed", code: "exception" });
  });

  it("si se agota el tiempo deja el resto sin reservar para la siguiente ejecución", async () => {
    const t = setup({ budgetMs: -1 });
    expect(await runDailyReport(t.deps)).toMatchObject({ sent: 0, remaining: 2 });
    expect(t.envios).toHaveLength(0);
  });
});

describe("ventana de ejecución", () => {
  it("antes de las 09:00 de Madrid no hace nada (por eso se puede lanzar a 07:00 y 08:00 UTC)", async () => {
    const t = setup({ now: new Date("2026-01-14T07:30:00Z") }); // 08:30 CET
    expect(await runDailyReport(t.deps)).toEqual({ status: "outside_window" });
    expect(t.sends).toHaveLength(0);
  });

  it("pasada la ventana (12:00 de Madrid) tampoco envía el informe de las 09:00", async () => {
    const t = setup({ now: new Date("2026-10-21T10:00:00Z") }); // 12:00 CEST
    expect(await runDailyReport(t.deps)).toEqual({ status: "outside_window" });
  });
});
