import { describe, expect, it, vi } from "vitest";
import type { DailyReportSnapshot } from "./snapshot";
import { runManualDailyReport, type ManualDailyReportDeps } from "./manual-test";
import { viewDailyReport, type DailyReportViewDeps, type InformeEnvio } from "./view";

type Row = { id: string; origin: string; slotDate: string; kind: string; snapshot: DailyReportSnapshot | null; wamid: string | null; status: string };

function setup(over: { access?: number[]; sendStatus?: "sent" | "failed" } = {}) {
  const rows: Row[] = [];
  const calls: string[] = [];
  const access = over.access ?? [1, 2];
  const deps: ManualDailyReportDeps = {
    resolveRestaurantIds: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, access]))),
    loadWindowData: vi.fn(async () => ({
      restaurants: new Map([
        [1, { id: 1, name: "Restaurante A", brand: "BK" }],
        [2, { id: 2, name: "Restaurante B", brand: "BK" }],
        [3, { id: 3, name: "Restaurante AJENO", brand: "BK" }],
      ]),
      metrics: new Map([
        [1, { reviews: 4, ratingSum: 18, positive: 3, neutral: 1, negative: 0 }],
        [3, { reviews: 9, ratingSum: 20, positive: 1, neutral: 1, negative: 7 }],
      ]),
      reasons: new Map<number, string | null>(),
    })),
    async reserve({ slot, origin }) {
      calls.push("reserve");
      const row: Row = { id: `envio-${rows.length + 1}`, origin: origin ?? "job", slotDate: slot.slotDate, kind: slot.kind, snapshot: null, wamid: null, status: "reserved" };
      rows.push(row);
      return { id: row.id };
    },
    async saveSnapshot(id, snapshot) {
      calls.push("snapshot");
      rows.find((row) => row.id === id)!.snapshot = snapshot;
    },
    send: vi.fn(async () => {
      calls.push("send");
      return over.sendStatus === "failed"
        ? ({ status: "failed", code: "131047", reason: "rejected", conversationId: "conv-1" } as const)
        : ({ status: "sent", messageId: "msg-1", wamid: `wamid.T${rows.length}`, conversationId: "conv-1" } as const);
    }),
    async markSent(id, result) {
      calls.push("markSent");
      Object.assign(rows.find((row) => row.id === id)!, { status: "sent", wamid: result.wamid });
    },
    async markFailed(id) {
      calls.push("markFailed");
      rows.find((row) => row.id === id)!.status = "failed";
    },
  };
  return { rows, calls, deps };
}

// Martes 13 oct 2026, 10:30 Madrid (CEST = UTC+2).
const TUESDAY = () => new Date("2026-10-13T08:30:00.000Z");
// Lunes 12 oct 2026, 10:30 Madrid.
const MONDAY = () => new Date("2026-10-12T08:30:00.000Z");

describe("prueba manual del informe diario = flujo real del job", () => {
  it("orden: restaurantes → métricas → fila → snapshot → plantilla → wamid guardado", async () => {
    const t = setup();
    t.deps.now = TUESDAY;
    const outcome = await runManualDailyReport({ contactId: "c-1", contactName: "tomas", requestId: "r-1" }, t.deps);

    expect(t.calls).toEqual(["reserve", "snapshot", "send", "markSent"]);
    expect(outcome).toMatchObject({ status: "sent", wamid: "wamid.T1", restaurants: 2, conversationId: "conv-1" });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ origin: "prueba", status: "sent", wamid: "wamid.T1", kind: "WEEK_TO_DATE", slotDate: "2026-10-13" });
  });

  it("solo los restaurantes del contacto entran en el snapshot (nunca el ajeno)", async () => {
    const t = setup({ access: [1, 2] });
    t.deps.now = TUESDAY;
    await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, t.deps);
    expect(t.deps.resolveRestaurantIds).toHaveBeenCalledWith(["c-1"]);
    expect(t.deps.loadWindowData).toHaveBeenCalledWith([1, 2], expect.anything());
    expect(t.rows[0]!.snapshot!.restaurants.map((r) => r.id)).toEqual([1, 2]);
    expect(JSON.stringify(t.rows[0]!.snapshot)).not.toContain("AJENO");
  });

  it("deny by default: sin restaurantes no se calcula, no se reserva y no se envía", async () => {
    const t = setup({ access: [] });
    const outcome = await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, t.deps);
    expect(outcome).toEqual({ status: "no_restaurants" });
    expect(t.calls).toEqual([]);
    expect(t.deps.loadWindowData).not.toHaveBeenCalled();
  });

  it("lunes → cierre semanal de la semana anterior; martes–domingo → semana en curso", async () => {
    const monday = setup();
    monday.deps.now = MONDAY;
    const closing = await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, monday.deps);
    expect(closing).toMatchObject({ status: "sent", slot: { kind: "WEEKLY_CLOSURE", slotDate: "2026-10-12", periodStart: "2026-10-05T00:00:00", periodEnd: "2026-10-12T00:00:00" } });

    const tuesday = setup();
    tuesday.deps.now = TUESDAY;
    const wtd = await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, tuesday.deps);
    expect(wtd).toMatchObject({ status: "sent", slot: { kind: "WEEK_TO_DATE", periodStart: "2026-10-12T00:00:00", periodEnd: "2026-10-13T09:00:00" } });
  });

  it("repetible sin choque: cada prueba crea su fila 'prueba' y no toca ninguna fila del job", async () => {
    const t = setup();
    t.deps.now = TUESDAY;
    await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, t.deps);
    await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-2" }, t.deps);
    expect(t.rows.map((row) => row.origin)).toEqual(["prueba", "prueba"]);
    expect(t.rows.filter((row) => row.origin === "job")).toHaveLength(0);
    // Una pulsación = una semilla distinta; la misma pulsación reutiliza la semilla (idempotencia del envío).
    const seeds = (t.deps.send as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0].requestSeed);
    expect(new Set(seeds).size).toBe(2);
  });

  it("si Meta rechaza, la fila queda 'failed' y no se reintenta", async () => {
    const t = setup({ sendStatus: "failed" });
    t.deps.now = TUESDAY;
    const outcome = await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, t.deps);
    expect(outcome).toMatchObject({ status: "failed", code: "131047" });
    expect(t.rows[0]!.status).toBe("failed");
    expect(t.calls).toEqual(["reserve", "snapshot", "send", "markFailed"]);
  });

  it("'Ver informe' sobre el aviso de prueba: se resuelve por wamid + contacto y sale del snapshot, sin recalcular", async () => {
    const t = setup();
    t.deps.now = TUESDAY;
    await runManualDailyReport({ contactId: "c-1", contactName: null, requestId: "r-1" }, t.deps);
    const row = t.rows[0]!;
    const envio: InformeEnvio = { id: row.id, contactoId: "c-1", slotDate: row.slotDate, snapshot: row.snapshot, sentAt: "2026-10-13T08:30:00.000Z" };

    const markViewed = vi.fn(async () => undefined);
    const viewDeps: DailyReportViewDeps = {
      findByWamid: async (wamid) => (wamid === row.wamid ? envio : null),
      findLatestForContact: async () => null,
      markViewed,
      resolveRestaurantIds: async () => [1, 2],
    };
    const view = await viewDailyReport({ contactId: "c-1", replyToWamid: row.wamid, redelivery: false }, viewDeps);
    expect(view.status).toBe("report");
    if (view.status === "report") {
      expect(view.fallback).toBe(false);
      expect(view.messages.join("\n")).toContain("Restaurante A");
    }
    expect(t.deps.loadWindowData).toHaveBeenCalledTimes(1); // solo en el envío, nunca al ver

    // Otro contacto con el mismo wamid no obtiene el informe.
    const other = await viewDailyReport({ contactId: "c-2", replyToWamid: row.wamid, redelivery: false }, viewDeps);
    expect(other.status).toBe("not_found");
  });
});
