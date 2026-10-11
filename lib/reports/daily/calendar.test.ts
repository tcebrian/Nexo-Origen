import { describe, expect, it } from "vitest";
import { addCalendarDays, currentSlot, formatDayRange, isoWeekday, madridClock, mondayOf, slotForDate } from "./calendar";

describe("semana natural", () => {
  it("lunes = 1 … domingo = 7 y el lunes de cualquier día de la semana", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
    for (const day of ["2026-10-19", "2026-10-20", "2026-10-23", "2026-10-25"]) expect(mondayOf(day)).toBe("2026-10-19");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
  });

  it("suma de días de calendario (no de 24 h) a través de los cambios de hora", () => {
    expect(addCalendarDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addCalendarDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addCalendarDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("lunes: WEEKLY_CLOSURE (semana anterior completa, fin exclusivo)", () => {
  it("lunes 19 de octubre → 12 oct 00:00 hasta 19 oct 00:00, incluye el domingo 18 entero", () => {
    expect(slotForDate("2026-10-19")).toEqual({
      kind: "WEEKLY_CLOSURE",
      slotDate: "2026-10-19",
      weekStart: "2026-10-12",
      periodStart: "2026-10-12T00:00:00",
      periodEnd: "2026-10-19T00:00:00",
      firstDay: "2026-10-12",
      lastDay: "2026-10-18",
      templateLabel: "cierre de la semana del 12 al 18 de octubre",
    });
  });

  it("el lunes siguiente se recalcula la semana completa como cierre: 19 → 26 oct", () => {
    const slot = slotForDate("2026-10-26");
    expect(slot).toMatchObject({ kind: "WEEKLY_CLOSURE", periodStart: "2026-10-19T00:00:00", periodEnd: "2026-10-26T00:00:00", lastDay: "2026-10-25" });
  });

  it("el cierre cruza de mes y de año sin romper la plantilla (≤ 60 caracteres)", () => {
    expect(slotForDate("2026-11-02").templateLabel).toBe("cierre de la semana del 26 de octubre al 1 de noviembre");
    expect(slotForDate("2027-01-04").templateLabel).toBe("cierre de la semana del 28 de diciembre al 3 de enero");
  });
});

describe("martes a domingo: WEEK_TO_DATE desde el lunes 00:00 hasta las 09:00 del slot", () => {
  it.each([
    ["2026-10-20", "2026-10-20T09:00:00", "semana en curso hasta el 20 de octubre"],
    ["2026-10-21", "2026-10-21T09:00:00", "semana en curso hasta el 21 de octubre"],
    ["2026-10-25", "2026-10-25T09:00:00", "semana en curso hasta el 25 de octubre"],
  ])("%s", (slotDate, end, label) => {
    expect(slotForDate(slotDate)).toMatchObject({
      kind: "WEEK_TO_DATE",
      weekStart: "2026-10-19",
      periodStart: "2026-10-19T00:00:00",
      periodEnd: end,
      firstDay: "2026-10-19",
      lastDay: slotDate,
      templateLabel: label,
    });
  });

  it("al empezar una semana nueva el acumulado parte otra vez del lunes: nunca mezcla semanas", () => {
    expect(slotForDate("2026-10-25").periodStart).toBe("2026-10-19T00:00:00");
    expect(slotForDate("2026-10-27").periodStart).toBe("2026-10-26T00:00:00");
  });
});

describe("cambios de hora (CET/CEST)", () => {
  it("domingo 29 de marzo de 2026 (se adelanta la hora): la ventana sigue siendo lunes 00:00 → 09:00 locales", () => {
    expect(slotForDate("2026-03-29")).toMatchObject({
      kind: "WEEK_TO_DATE",
      periodStart: "2026-03-23T00:00:00",
      periodEnd: "2026-03-29T09:00:00",
    });
    // El lunes siguiente cierra la semana del cambio completa.
    expect(slotForDate("2026-03-30")).toMatchObject({
      kind: "WEEKLY_CLOSURE",
      periodStart: "2026-03-23T00:00:00",
      periodEnd: "2026-03-30T00:00:00",
      lastDay: "2026-03-29",
    });
  });

  it("domingo 25 de octubre de 2026 (se atrasa la hora): igual", () => {
    expect(slotForDate("2026-10-25")).toMatchObject({
      kind: "WEEK_TO_DATE",
      periodStart: "2026-10-19T00:00:00",
      periodEnd: "2026-10-25T09:00:00",
    });
    expect(slotForDate("2026-10-26")).toMatchObject({
      kind: "WEEKLY_CLOSURE",
      periodStart: "2026-10-19T00:00:00",
      periodEnd: "2026-10-26T00:00:00",
    });
  });

  it("las 09:00 de Madrid se reconocen en verano (UTC+2) y en invierno (UTC+1)", () => {
    // 24 oct 2026: horario de verano (CEST, UTC+2).
    expect(madridClock(new Date("2026-10-24T07:00:00Z"))).toEqual({ date: "2026-10-24", hour: 9, minute: 0 });
    expect(currentSlot(new Date("2026-10-24T07:00:00Z"))?.slotDate).toBe("2026-10-24");
    expect(currentSlot(new Date("2026-10-24T06:59:00Z"))).toBeNull();
    // 25 oct 2026: a la 01:00 UTC pasa a horario de invierno (CET, UTC+1): las 09:00 son las 08:00 UTC.
    expect(currentSlot(new Date("2026-10-25T07:00:00Z"))).toBeNull();
    expect(currentSlot(new Date("2026-10-25T08:00:00Z"))).toMatchObject({ slotDate: "2026-10-25", kind: "WEEK_TO_DATE" });
    // 29 mar 2026: a la 01:00 UTC pasa a verano: las 09:00 son las 07:00 UTC.
    expect(currentSlot(new Date("2026-03-29T06:59:00Z"))).toBeNull();
    expect(currentSlot(new Date("2026-03-29T07:00:00Z"))).toMatchObject({ slotDate: "2026-03-29" });
    // Invierno normal, lunes.
    expect(currentSlot(new Date("2026-01-12T08:00:00Z"))).toMatchObject({ slotDate: "2026-01-12", kind: "WEEKLY_CLOSURE" });
  });

  it("la ejecución puede llegar tarde (hasta antes de las 12:00 de Madrid); el slot sigue siendo el de las 09:00", () => {
    const late = currentSlot(new Date("2026-10-21T08:40:00Z")); // 10:40 CEST
    expect(late).toMatchObject({ slotDate: "2026-10-21", periodEnd: "2026-10-21T09:00:00" });
    expect(currentSlot(new Date("2026-10-21T10:00:00Z"))).toBeNull(); // 12:00 CEST: ventana cerrada
  });

  it("el día de calendario es el de Madrid aunque en UTC sea otro", () => {
    // 23:30 UTC del 20 son las 01:30 del 21 en Madrid (verano): todavía no es hora del slot.
    expect(madridClock(new Date("2026-10-20T23:30:00Z"))).toMatchObject({ date: "2026-10-21", hour: 1 });
    expect(currentSlot(new Date("2026-10-20T23:30:00Z"))).toBeNull();
  });
});

describe("textos de la plantilla", () => {
  it("rangos con y sin año", () => {
    expect(formatDayRange("2026-10-12", "2026-10-18")).toBe("12 al 18 de octubre");
    expect(formatDayRange("2026-10-12", "2026-10-18", true)).toBe("12 al 18 de octubre de 2026");
    expect(formatDayRange("2026-12-28", "2027-01-03", true)).toBe("28 de diciembre de 2026 al 3 de enero de 2027");
  });

  it("ningún día del año supera el límite de 60 caracteres de la variable {{2}}", () => {
    for (let offset = 0; offset < 366; offset++) {
      const label = slotForDate(addCalendarDays("2026-01-01", offset)).templateLabel;
      expect(label.length, label).toBeLessThanOrEqual(60);
    }
  });
});
