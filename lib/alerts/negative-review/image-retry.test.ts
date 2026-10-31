import { describe, expect, it, vi } from "vitest";
import { buildImageFailedText } from "./message";
import {
  IMAGE_RETRY_AFTER_MS,
  retryFailedImageAlerts,
  type AlertPatch,
  type AlertReview,
  type DeliverResult,
  type ImageFailedAlert,
  type ImageRetryDeps,
} from "./orchestrator";

const NOW = new Date("2026-10-31T08:00:00Z");
const REVIEW: AlertReview = { resenaId: 501, restauranteId: 7, stars: 1, restaurantName: "BK Utebo" };
const ALERT: ImageFailedAlert = { id: "a-1", resenaId: 501, restauranteId: 7, contactId: "c-1", contactName: "tomas", conversationId: "conv-1" };

function setup(over: { alerts?: ImageFailedAlert[]; deliver?: DeliverResult; windowOpen?: boolean; claim?: boolean; notice?: boolean; notified?: boolean } = {}) {
  const patches: AlertPatch[] = [];
  const deps: ImageRetryDeps = {
    now: () => NOW,
    listImageFailed: vi.fn(async () => over.alerts ?? [ALERT]),
    claim: vi.fn(async () => over.claim ?? true),
    loadReview: vi.fn(async () => REVIEW),
    update: vi.fn(async (_id: string, patch: AlertPatch) => {
      patches.push(patch);
    }),
    isWindowOpen: vi.fn(async () => over.windowOpen ?? true),
    lastInboundAt: vi.fn(async () => new Date("2026-10-31T01:00:00Z")),
    deliverContent: vi.fn(async () => over.deliver ?? ({ status: "sent" } as const)),
    sendFailureNotice: vi.fn(async () => over.notice ?? true),
    hasNotifiedTemplate: vi.fn(async () => over.notified ?? false),
    countOutstanding: vi.fn(async () => 2),
    sendTemplate: vi.fn(async () => ({ status: "sent", wamid: "wamid.X" }) as const),
  };
  return { deps, patches };
}

describe("reintento de imagen fallida", () => {
  it("solo recoge alertas con al menos 5 minutos", async () => {
    const t = setup();
    await retryFailedImageAlerts(t.deps);
    expect(t.deps.listImageFailed).toHaveBeenCalledWith(new Date(NOW.getTime() - IMAGE_RETRY_AFTER_MS));
    expect(IMAGE_RETRY_AFTER_MS).toBe(5 * 60 * 1000);
  });

  it("el reintento funciona: se entrega, sin aviso y sin plantilla", async () => {
    const t = setup();
    expect(await retryFailedImageAlerts(t.deps)).toEqual({ retried: 1, delivered: 1, noticed: 0, templated: 0 });
    expect(t.patches.at(-1)).toMatchObject({ status: "delivered", via: "direct", errorReason: null });
    expect(t.deps.sendFailureNotice).not.toHaveBeenCalled();
    expect(t.deps.sendTemplate).not.toHaveBeenCalled();
  });

  it("vuelve a fallar: deja el aviso, queda cerrada (image_failed_final) y no se manda plantilla", async () => {
    const t = setup({ deliver: { status: "rejected", code: "generation_failed" } });
    expect(await retryFailedImageAlerts(t.deps)).toEqual({ retried: 1, delivered: 0, noticed: 1, templated: 0 });
    expect(t.deps.sendFailureNotice).toHaveBeenCalledTimes(1);
    expect(t.deps.sendTemplate).not.toHaveBeenCalled();
    const last = t.patches.at(-1)!;
    expect(last.status).toBe("pending");
    expect(last.errorReason).toMatch(/^image_failed_final;notice_sent;last_inbound=2026-10-31T01:00:00.000Z;window_until=2026-11-01T01:00:00.000Z$/);
    // El marcador final no empieza por el prefijo que recoge el reintento: no se repite.
    expect(last.errorReason!.startsWith("image_failed;")).toBe(false);
  });

  it("si el aviso tampoco sale queda anotado", async () => {
    const t = setup({ deliver: { status: "rejected", code: "generation_failed" }, notice: false });
    expect(await retryFailedImageAlerts(t.deps)).toMatchObject({ noticed: 0 });
    expect(t.patches.at(-1)!.errorReason).toContain("notice_failed");
  });

  it("si la ventana se cerró entretanto: plantilla, pero solo una por contacto", async () => {
    const closed = setup({ windowOpen: false });
    expect(await retryFailedImageAlerts(closed.deps)).toMatchObject({ templated: 1, delivered: 0 });
    expect(closed.deps.deliverContent).not.toHaveBeenCalled();

    const already = setup({ windowOpen: false, notified: true });
    expect(await retryFailedImageAlerts(already.deps)).toMatchObject({ templated: 0 });
    expect(already.deps.sendTemplate).not.toHaveBeenCalled();
  });

  it("incierto: no se reenvía ni se avisa a ciegas", async () => {
    const t = setup({ deliver: { status: "uncertain", code: "unconfirmed" } });
    expect(await retryFailedImageAlerts(t.deps)).toMatchObject({ delivered: 0, noticed: 0 });
    expect(t.patches.at(-1)).toMatchObject({ status: "failed" });
  });

  it("si otro proceso ya la tomó no se toca", async () => {
    const t = setup({ claim: false });
    expect(await retryFailedImageAlerts(t.deps)).toEqual({ retried: 0, delivered: 0, noticed: 0, templated: 0 });
    expect(t.deps.deliverContent).not.toHaveBeenCalled();
  });

  it("una excepción no deja la alerta en 'delivering' ni se reintenta en bucle", async () => {
    const t = setup();
    vi.mocked(t.deps.deliverContent).mockRejectedValueOnce(new Error("boom"));
    await retryFailedImageAlerts(t.deps);
    expect(t.patches.at(-1)).toMatchObject({ status: "pending" });
    expect(t.patches.at(-1)!.errorReason!.startsWith("image_failed_final")).toBe(true);
  });
});

describe("texto del aviso", () => {
  it("restaurante, valoración y enlace; sin datos del autor", () => {
    expect(buildImageFailedText({ restaurantName: "BK Utebo", stars: 1, link: "https://maps.example/x" })).toBe(
      ["⚠️ Hay una reseña negativa cuya imagen no se ha podido generar.", "Restaurante: BK Utebo", "Valoración: 1★", "", "🔗 Puedes verla en Google Maps:", "https://maps.example/x"].join("\n")
    );
    expect(buildImageFailedText({ restaurantName: "BK", stars: 2, link: null })).not.toContain("Google Maps");
  });
});
