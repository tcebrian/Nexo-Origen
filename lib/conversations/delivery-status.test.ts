import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PENDING_STALE_MS, describeDeliveryStatus } from "@/lib/conversations/delivery-status";
import { mapMessageRow, type MessageReadRow } from "@/lib/conversations/read-model";

describe("indicador de entrega (UI)", () => {
  it("pending: reloj y 'Enviando'; si lleva mucho tiempo, 'Sin confirmar'", () => {
    expect(describeDeliveryStatus("pending", 1000)).toMatchObject({ kind: "pending", ticks: 0, label: "Enviando", tone: "muted" });
    expect(describeDeliveryStatus("pending", PENDING_STALE_MS + 1)).toMatchObject({
      kind: "pending",
      label: "Sin confirmar",
      showLabel: true,
      tone: "warning",
    });
  });

  it("sent: un check", () => {
    expect(describeDeliveryStatus("sent")).toMatchObject({ kind: "sent", ticks: 1, label: "Enviado", tone: "muted" });
  });

  it("delivered: dos checks", () => {
    expect(describeDeliveryStatus("delivered")).toMatchObject({ kind: "delivered", ticks: 2, label: "Entregado", tone: "muted" });
  });

  it("read: dos checks destacados con el violeta de Nexo", () => {
    expect(describeDeliveryStatus("read")).toMatchObject({ kind: "read", ticks: 2, label: "Leído", tone: "read" });
  });

  it("failed: aviso 'No entregado' visible", () => {
    expect(describeDeliveryStatus("failed")).toMatchObject({
      kind: "failed",
      ticks: 0,
      label: "No entregado",
      showLabel: true,
      tone: "error",
    });
  });

  it("deleted: aviso 'Eliminado'; estados de entrada o desconocidos no llevan indicador", () => {
    expect(describeDeliveryStatus("deleted")).toMatchObject({ kind: "deleted", label: "Eliminado" });
    expect(describeDeliveryStatus("received")).toBeNull();
    expect(describeDeliveryStatus("lo-que-sea")).toBeNull();
  });
});

describe("burbujas", () => {
  const view = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"), "utf-8");

  it("solo los mensajes salientes llevan indicador", () => {
    expect(view).toContain('const outbound = message.direction === "outbound"');
    expect(view).toMatch(/const indicator = outbound\s*\?\s*describeDeliveryStatus/);
  });

  it("pinta checks con la paleta de Nexo, sin colores de WhatsApp", () => {
    expect(view).toContain("DeliveryMark");
    expect(view).toContain("text-violet-300");
    expect(view).not.toMatch(/#25D366|#34B7F1|#53BDEB/i);
  });
});

describe("API de lectura", () => {
  const row: MessageReadRow = {
    id: "m1",
    direction: "outbound",
    sender_type: "human",
    content_type: "text",
    text: "hola",
    media: null,
    status: "delivered",
    provider_timestamp: "2026-10-07T10:00:00Z",
    received_at: null,
  };

  it("devuelve el estado de cada mensaje", () => {
    for (const status of ["pending", "sent", "delivered", "read", "failed", "deleted"]) {
      expect(mapMessageRow({ ...row, status }).status).toBe(status);
    }
  });

  it("no expone raw_payload ni el error del proveedor", () => {
    const dirty = {
      ...row,
      status: "failed",
      raw_payload: { errors: [{ code: 131026, title: "Message undeliverable", message: "secreto" }] },
      error: { code: 131026, message: "secreto" },
    };
    const dto = mapMessageRow(dirty);
    const json = JSON.stringify(dto);
    expect(json).not.toContain("raw_payload");
    expect(json).not.toContain("131026");
    expect(json).not.toContain("secreto");
    expect(Object.keys(dto).sort()).toEqual(
      ["caption", "contentType", "direction", "filename", "id", "label", "status", "text", "timestamp"].sort()
    );
  });
});
