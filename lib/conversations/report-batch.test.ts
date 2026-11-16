import { describe, expect, it, vi } from "vitest";
import { sendReportBatch, type ReportBatchItem, type ReportSendAttempt } from "./report-batch";

type Sel = { restaurantId: number };
const items: ReportBatchItem<Sel>[] = [
  { key: "r1", label: "BK Uno", selection: { restaurantId: 1 } },
  { key: "r2", label: "BK Dos", selection: { restaurantId: 2 } },
  { key: "r3", label: "BK Tres", selection: { restaurantId: 3 } },
];

const ok = (id: string): ReportSendAttempt<string> => ({ ok: true, messages: [id] });

function deps(responses: Record<number, ReportSendAttempt<string>[] | (() => never)>) {
  const calls: { restaurantId: number; requestId: string }[] = [];
  const waits: number[] = [];
  const counters = new Map<number, number>();
  return {
    calls,
    waits,
    deps: {
      requestIdFor: (key: string) => `req-${key}`,
      wait: async (ms: number) => {
        waits.push(ms);
      },
      send: async (selection: Sel, requestId: string) => {
        calls.push({ restaurantId: selection.restaurantId, requestId });
        const entry = responses[selection.restaurantId];
        if (typeof entry === "function") entry();
        const index = counters.get(selection.restaurantId) ?? 0;
        counters.set(selection.restaurantId, index + 1);
        const list = entry as ReportSendAttempt<string>[];
        return list[Math.min(index, list.length - 1)]!;
      },
    },
  };
}

describe("sendReportBatch", () => {
  it("envía todos los informes en orden, cada uno con su requestId", async () => {
    const { calls, deps: d } = deps({ 1: [ok("a")], 2: [ok("b")], 3: [ok("c")] });
    const onSent = vi.fn();
    const result = await sendReportBatch(items, { ...d, onSent });

    expect(calls).toEqual([
      { restaurantId: 1, requestId: "req-r1" },
      { restaurantId: 2, requestId: "req-r2" },
      { restaurantId: 3, requestId: "req-r3" },
    ]);
    expect(result).toEqual({ sent: ["r1", "r2", "r3"], failed: [], skipped: [], stoppedError: null });
    expect(onSent).toHaveBeenCalledTimes(3);
  });

  it("ante el límite por minuto (429) espera y reintenta el MISMO informe con el MISMO requestId", async () => {
    const limited: ReportSendAttempt<string> = { ok: false, status: 429, error: "Demasiadas", retryAfterSeconds: 7 };
    const { calls, waits, deps: d } = deps({ 1: [ok("a")], 2: [limited, ok("b")], 3: [ok("c")] });
    const result = await sendReportBatch(items, d);

    expect(waits).toEqual([7000]);
    expect(calls.filter((call) => call.restaurantId === 2)).toEqual([
      { restaurantId: 2, requestId: "req-r2" },
      { restaurantId: 2, requestId: "req-r2" },
    ]);
    expect(result.sent).toEqual(["r1", "r2", "r3"]);
  });

  it("un fallo de un informe no impide enviar los demás", async () => {
    const failed: ReportSendAttempt<string> = {
      ok: false,
      status: 404,
      code: "report_not_found",
      error: "Restaurante o periodo no disponible",
    };
    const { deps: d } = deps({ 1: [ok("a")], 2: [failed], 3: [ok("c")] });
    const result = await sendReportBatch(items, d);

    expect(result.sent).toEqual(["r1", "r3"]);
    expect(result.failed).toEqual([{ key: "r2", label: "BK Dos", error: "Restaurante o periodo no disponible" }]);
    expect(result.stoppedError).toBeNull();
  });

  it("un error de la conversación (ventana de 24 h cerrada) para el lote: el resto fallaría igual", async () => {
    const closed: ReportSendAttempt<string> = { ok: false, status: 502, code: "window_closed", error: "Ventana cerrada" };
    const { calls, deps: d } = deps({ 1: [closed], 2: [ok("b")], 3: [ok("c")] });
    const result = await sendReportBatch(items, d);

    expect(calls).toHaveLength(1);
    expect(result.sent).toEqual([]);
    expect(result.skipped).toEqual(["r2", "r3"]);
    expect(result.stoppedError).toBe("Ventana cerrada");
  });

  it("un error de red cuenta como fallo de ese informe y se sigue con el resto", async () => {
    const { deps: d } = deps({
      1: () => {
        throw new Error("offline");
      },
      2: [ok("b")],
      3: [ok("c")],
    });
    const result = await sendReportBatch(items, d);

    expect(result.failed.map((item) => item.key)).toEqual(["r1"]);
    expect(result.sent).toEqual(["r2", "r3"]);
  });

  it("los mensajes de un envío parcial se entregan aunque el informe falle", async () => {
    const partial: ReportSendAttempt<string> = { ok: false, status: 502, code: "unconfirmed", error: "x", messages: ["p1"] };
    const { deps: d } = deps({ 1: [partial], 2: [ok("b")], 3: [ok("c")] });
    const onPartial = vi.fn();
    await sendReportBatch(items, { ...d, onPartial });
    expect(onPartial).toHaveBeenCalledWith(["p1"]);
  });

  it("deja de reintentar un 429 tras el máximo de reintentos", async () => {
    const limited: ReportSendAttempt<string> = { ok: false, status: 429, error: "Demasiadas", retryAfterSeconds: 1 };
    const { waits, deps: d } = deps({ 1: [limited], 2: [ok("b")], 3: [ok("c")] });
    const result = await sendReportBatch(items, { ...d, maxRateLimitRetries: 2 });

    expect(waits).toHaveLength(2);
    expect(result.failed.map((item) => item.key)).toEqual(["r1"]);
    expect(result.sent).toEqual(["r2", "r3"]);
  });
});
