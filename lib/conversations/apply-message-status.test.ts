import { describe, expect, it } from "vitest";
import {
  applyWhatsAppMessageStatus,
  type StatusRepository,
} from "@/lib/conversations/apply-message-status";
import { shouldApplyStatus } from "@/lib/conversations/status-transitions";
import type { MessageStatus, MessageStatusUpdate } from "@/lib/conversations/types";

const CHANNEL_EXTERNAL = "1365004563368241";

type Row = { canalId: string; externalId: string; direction: "inbound" | "outbound"; status: MessageStatus };

/** Repositorio en memoria con la misma regla que la actualización condicional real. */
function setup(rows: Row[], options: { channelStatus?: "found" | "inactive" | "not_found" } = {}) {
  const store = rows.map((row) => ({ ...row }));
  const inserts: unknown[] = [];
  const repository: StatusRepository = {
    async resolveChannel(provider, externalAccountId) {
      if (provider !== "whatsapp_cloud" || externalAccountId !== CHANNEL_EXTERNAL) return { status: "not_found" };
      const status = options.channelStatus ?? "found";
      return status === "not_found" ? { status: "not_found" } : { status, channel: { id: "canal-1" } };
    },
    async applyStatus({ canalId, externalMessageId, incoming }) {
      const row = store.find(
        (r) => r.canalId === canalId && r.externalId === externalMessageId && r.direction === "outbound"
      );
      if (!row) return "not_found";
      if (!shouldApplyStatus(row.status, incoming)) return "unchanged";
      row.status = incoming;
      return "updated";
    },
  };
  const apply = (status: MessageStatusUpdate["status"], over: Partial<MessageStatusUpdate> = {}) =>
    applyWhatsAppMessageStatus(repository, "whatsapp_cloud", {
      externalMessageId: "wamid.OUT1",
      externalChannelId: CHANNEL_EXTERNAL,
      recipientPhone: "+34600111222",
      status,
      providerTimestamp: new Date("2026-10-07T10:00:00Z"),
      ...over,
    });
  return { store, inserts, apply };
}

const outbound = (status: MessageStatus): Row => ({
  canalId: "canal-1",
  externalId: "wamid.OUT1",
  direction: "outbound",
  status,
});

describe("applyWhatsAppMessageStatus", () => {
  it("sent actualiza un saliente pending", async () => {
    const t = setup([outbound("pending")]);
    expect(await t.apply("sent")).toEqual({ status: "updated" });
    expect(t.store[0]!.status).toBe("sent");
  });

  it("delivered avanza desde sent y read desde delivered", async () => {
    const t = setup([outbound("sent")]);
    expect(await t.apply("delivered")).toEqual({ status: "updated" });
    expect(t.store[0]!.status).toBe("delivered");
    expect(await t.apply("read")).toEqual({ status: "updated" });
    expect(t.store[0]!.status).toBe("read");
  });

  it("read recibido directamente desde sent funciona", async () => {
    const t = setup([outbound("sent")]);
    expect(await t.apply("read")).toEqual({ status: "updated" });
    expect(t.store[0]!.status).toBe("read");
  });

  it("delivered después de read NO degrada; sent después de delivered NO degrada", async () => {
    const t = setup([outbound("read")]);
    expect(await t.apply("delivered")).toEqual({ status: "unchanged" });
    expect(await t.apply("sent")).toEqual({ status: "unchanged" });
    expect(t.store[0]!.status).toBe("read");

    const u = setup([outbound("delivered")]);
    expect(await u.apply("sent")).toEqual({ status: "unchanged" });
    expect(u.store[0]!.status).toBe("delivered");
  });

  it("una secuencia desordenada termina siempre en el estado más avanzado", async () => {
    const t = setup([outbound("pending")]);
    for (const status of ["read", "sent", "delivered", "sent", "read", "delivered"] as const) {
      await t.apply(status);
    }
    expect(t.store[0]!.status).toBe("read");
  });

  it("el mismo estado repetido es idempotente: una sola actualización lógica y ninguna fila nueva", async () => {
    const t = setup([outbound("sent")]);
    const results = [await t.apply("delivered"), await t.apply("delivered"), await t.apply("delivered")];
    expect(results.map((r) => r.status)).toEqual(["updated", "unchanged", "unchanged"]);
    expect(t.store).toHaveLength(1);
  });

  it("wamid desconocido: no crea mensajes ni falla", async () => {
    const t = setup([outbound("sent")]);
    expect(await t.apply("delivered", { externalMessageId: "wamid.DESCONOCIDO" })).toEqual({
      status: "message_not_found",
    });
    expect(t.store).toHaveLength(1);
    expect(t.store[0]!.status).toBe("sent");
  });

  it("canal desconocido: resultado normal, sin tocar nada", async () => {
    const t = setup([outbound("sent")]);
    expect(await t.apply("delivered", { externalChannelId: "999" })).toEqual({ status: "channel_not_found" });
    expect(t.store[0]!.status).toBe("sent");
  });

  it("un canal inactivo igualmente recibe los estados de sus mensajes salientes", async () => {
    const t = setup([outbound("sent")], { channelStatus: "inactive" });
    expect(await t.apply("delivered")).toEqual({ status: "updated" });
  });

  it("failed sustituye a sent/pending pero no a delivered ni a read", async () => {
    const sent = setup([outbound("sent")]);
    expect(await sent.apply("failed")).toEqual({ status: "updated" });
    expect(sent.store[0]!.status).toBe("failed");

    for (const status of ["delivered", "read"] as const) {
      const t = setup([outbound(status)]);
      expect(await t.apply("failed")).toEqual({ status: "unchanged" });
      expect(t.store[0]!.status).toBe(status);
    }
  });

  it("deleted solo sobre un mensaje ya aceptado y después nada lo cambia", async () => {
    const t = setup([outbound("read")]);
    expect(await t.apply("deleted")).toEqual({ status: "updated" });
    expect(await t.apply("delivered")).toEqual({ status: "unchanged" });
    expect(t.store[0]!.status).toBe("deleted");

    const failed = setup([outbound("failed")]);
    expect(await failed.apply("deleted")).toEqual({ status: "unchanged" });
  });

  it("un mensaje entrante con el mismo wamid no se modifica", async () => {
    const inbound: Row = { canalId: "canal-1", externalId: "wamid.OUT1", direction: "inbound", status: "received" };
    const t = setup([inbound]);
    expect(await t.apply("read")).toEqual({ status: "message_not_found" });
    expect(t.store[0]!.status).toBe("received");
  });

  it("solo localiza por canal + wamid: el teléfono del estado no interviene", async () => {
    const t = setup([outbound("sent")]);
    expect(await t.apply("delivered", { recipientPhone: "+34999999999" })).toEqual({ status: "updated" });
  });
});
