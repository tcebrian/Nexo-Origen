import { describe, expect, it } from "vitest";
import { shouldApplyStatus, statusesAllowedBefore } from "@/lib/conversations/status-transitions";

describe("transiciones de estado de un saliente", () => {
  it("avanza pending → sent → delivered → read", () => {
    expect(shouldApplyStatus("pending", "sent")).toBe(true);
    expect(shouldApplyStatus("sent", "delivered")).toBe(true);
    expect(shouldApplyStatus("delivered", "read")).toBe(true);
  });

  it("read puede llegar directamente desde sent o pending (delivered se perdió)", () => {
    expect(shouldApplyStatus("sent", "read")).toBe(true);
    expect(shouldApplyStatus("pending", "read")).toBe(true);
  });

  it("nunca degrada: delivered tras read, sent tras delivered/read", () => {
    expect(shouldApplyStatus("read", "delivered")).toBe(false);
    expect(shouldApplyStatus("read", "sent")).toBe(false);
    expect(shouldApplyStatus("delivered", "sent")).toBe(false);
  });

  it("repetir el mismo estado no cambia nada (idempotencia)", () => {
    for (const status of ["sent", "delivered", "read", "failed", "deleted"] as const) {
      expect(shouldApplyStatus(status, status)).toBe(false);
    }
  });

  it("failed solo sustituye a pending/sent: nunca a delivered, read ni deleted", () => {
    expect(shouldApplyStatus("pending", "failed")).toBe(true);
    expect(shouldApplyStatus("sent", "failed")).toBe(true);
    expect(shouldApplyStatus("delivered", "failed")).toBe(false);
    expect(shouldApplyStatus("read", "failed")).toBe(false);
    expect(shouldApplyStatus("deleted", "failed")).toBe(false);
  });

  it("una entrega confirmada corrige un failed previo, pero sent no", () => {
    expect(shouldApplyStatus("failed", "delivered")).toBe(true);
    expect(shouldApplyStatus("failed", "read")).toBe(true);
    expect(shouldApplyStatus("failed", "sent")).toBe(false);
  });

  it("deleted solo sobre un mensaje aceptado (sent/delivered/read) y es terminal", () => {
    expect(shouldApplyStatus("sent", "deleted")).toBe(true);
    expect(shouldApplyStatus("delivered", "deleted")).toBe(true);
    expect(shouldApplyStatus("read", "deleted")).toBe(true);
    expect(shouldApplyStatus("pending", "deleted")).toBe(false);
    expect(shouldApplyStatus("failed", "deleted")).toBe(false);
    for (const incoming of ["sent", "delivered", "read", "failed"] as const) {
      expect(shouldApplyStatus("deleted", incoming)).toBe(false);
    }
  });

  it("un mensaje entrante (received) nunca cambia con un estado", () => {
    for (const incoming of ["sent", "delivered", "read", "failed", "deleted"] as const) {
      expect(shouldApplyStatus("received", incoming)).toBe(false);
      expect(statusesAllowedBefore(incoming)).not.toContain("received");
    }
  });
});
