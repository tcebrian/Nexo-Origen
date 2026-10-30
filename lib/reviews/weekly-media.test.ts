import { describe, expect, it } from "vitest";
import { naturalWeekBounds } from "./weekly-media";

describe("naturalWeekBounds", () => {
  it("lunes–domingo: cualquier día de la semana da el mismo rango [lunes, lunes siguiente)", () => {
    for (const day of ["2026-10-26T14:47:47.692", "2026-10-28 12:00:00", "2026-11-01T23:59:59Z"]) {
      expect(naturalWeekBounds(day)).toEqual({ start: "2026-10-26", end: "2026-11-02" });
    }
  });

  it("el domingo pertenece a la semana que termina; el lunes siguiente abre otra", () => {
    expect(naturalWeekBounds("2026-10-25T20:00:00Z")).toEqual({ start: "2026-10-19", end: "2026-10-26" });
    expect(naturalWeekBounds("2026-11-02T00:00:00Z")).toEqual({ start: "2026-11-02", end: "2026-11-09" });
  });

  it("cruza mes y año", () => {
    expect(naturalWeekBounds("2026-12-31")).toEqual({ start: "2026-12-28", end: "2027-01-04" });
  });

  it("fecha no válida → null", () => {
    expect(naturalWeekBounds("")).toBeNull();
    expect(naturalWeekBounds("ayer")).toBeNull();
  });
});
