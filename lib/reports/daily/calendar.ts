/**
 * Calendario del informe diario de Nexo. TODO pasa por Europe/Madrid.
 *
 * Nexo trabaja por SEMANAS NATURALES (lunes 00:00 → lunes siguiente 00:00, fin exclusivo) y envía a las
 * 09:00 de Madrid:
 *   · Lunes            → WEEKLY_CLOSURE: la semana anterior COMPLETA (lunes 00:00 → lunes 00:00 de hoy).
 *   · Martes a domingo → WEEK_TO_DATE: desde el lunes 00:00 de esta semana hasta las 09:00 de hoy.
 *
 * Los instantes se representan como "hora de pared" de Madrid (`YYYY-MM-DDTHH:MM:SS`, sin zona), que es
 * cómo guarda Supabase `resenas.fecha_resena`. Así el horario de verano/invierno no necesita ninguna
 * conversión: la semana del 25 de octubre dura 25 h y la del 29 de marzo 23 h, y los límites siguen
 * siendo "00:00" y "09:00" locales. Nunca se suman 24 h ni 7×24 h: se opera con fechas de calendario.
 *
 * El slot lógico es SIEMPRE las 09:00 del día de calendario; la hora real de ejecución solo decide si
 * toca ejecutar (ver `currentSlot`).
 */

export const APP_TIMEZONE = "Europe/Madrid";
export const SLOT_HOUR = 9;
/** El slot se puede ejecutar hasta esta hora (excl.) de Madrid; pasada, ya no se envía "el de las 09:00". */
export const SLOT_LATEST_HOUR = 12;

export type DailyReportKind = "WEEKLY_CLOSURE" | "WEEK_TO_DATE";

export type DailySlot = {
  kind: DailyReportKind;
  /** Día de calendario (Madrid) del slot, YYYY-MM-DD. */
  slotDate: string;
  /** Lunes de la semana a la que corresponde el informe. */
  weekStart: string;
  /** Inicio de la ventana, hora de pared de Madrid (incluido). */
  periodStart: string;
  /** Fin de la ventana, hora de pared de Madrid (EXCLUIDO). */
  periodEnd: string;
  /** Primer y último día de calendario cubiertos (el último, completo en el cierre y hasta hoy en curso). */
  firstDay: string;
  lastDay: string;
  /** Texto de la variable {{2}} de la plantilla `informe_diario` (máx. 60 caracteres). */
  templateLabel: string;
};

const DAY_MS = 86_400_000;

type DayParts = { year: number; month: number; day: number };

function parseDay(key: string): DayParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Fecha no válida: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toUtcNoon({ year, month, day }: DayParts): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function keyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma días de CALENDARIO (a mediodía UTC no hay saltos de horario). */
export function addCalendarDays(key: string, days: number): string {
  return keyOf(new Date(toUtcNoon(parseDay(key)).getTime() + days * DAY_MS));
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(key: string): number {
  const dow = toUtcNoon(parseDay(key)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function mondayOf(key: string): string {
  return addCalendarDays(key, 1 - isoWeekday(key));
}

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha y hora de pared en Madrid de un instante. */
export function madridClock(now: Date): { date: string; hour: number; minute: number } {
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** "14 de octubre" (con `withYear`: "14 de octubre de 2026"). */
export function formatDay(key: string, withYear = false): string {
  const { year, month, day } = parseDay(key);
  return `${day} de ${MONTHS[month - 1]}${withYear ? ` de ${year}` : ""}`;
}

export function weekdayName(key: string): string {
  return WEEKDAYS[isoWeekday(key) - 1]!;
}

/**
 * "12 al 18 de octubre" · "29 de septiembre al 5 de octubre". Con `withYear` añade el año (informe).
 * Sin año, un rango que cruza de año tampoco lo lleva: cabe en el límite de 60 caracteres de la plantilla.
 */
export function formatDayRange(firstKey: string, lastKey: string, withYear = false): string {
  const first = parseDay(firstKey);
  const last = parseDay(lastKey);
  const sameYear = first.year === last.year;
  const sameMonth = sameYear && first.month === last.month;

  if (sameMonth) return `${first.day} al ${last.day} de ${MONTHS[last.month - 1]}${withYear ? ` de ${last.year}` : ""}`;
  if (sameYear) return `${formatDay(firstKey)} al ${formatDay(lastKey)}${withYear ? ` de ${last.year}` : ""}`;
  return `${formatDay(firstKey, withYear)} al ${formatDay(lastKey, withYear)}`;
}

/** Slot lógico (09:00 de Madrid) de un día de calendario. */
export function slotForDate(slotDate: string): DailySlot {
  const weekday = isoWeekday(slotDate);
  const thisMonday = mondayOf(slotDate);

  if (weekday === 1) {
    // Lunes: cierre de la semana anterior COMPLETA. Fin exclusivo = hoy 00:00 (incluye el domingo entero).
    const previousMonday = addCalendarDays(thisMonday, -7);
    const sunday = addCalendarDays(previousMonday, 6);
    return {
      kind: "WEEKLY_CLOSURE",
      slotDate,
      weekStart: previousMonday,
      periodStart: `${previousMonday}T00:00:00`,
      periodEnd: `${slotDate}T00:00:00`,
      firstDay: previousMonday,
      lastDay: sunday,
      templateLabel: `cierre de la semana del ${formatDayRange(previousMonday, sunday)}`,
    };
  }

  // Martes–domingo: la semana en curso, desde su lunes 00:00 hasta las 09:00 del slot.
  return {
    kind: "WEEK_TO_DATE",
    slotDate,
    weekStart: thisMonday,
    periodStart: `${thisMonday}T00:00:00`,
    periodEnd: `${slotDate}T${String(SLOT_HOUR).padStart(2, "0")}:00:00`,
    firstDay: thisMonday,
    lastDay: slotDate,
    templateLabel: `semana en curso hasta el ${formatDay(slotDate)}`,
  };
}

/**
 * El slot que toca ejecutar ahora, o `null` si todavía no son las 09:00 en Madrid o ya pasó la ventana de
 * ejecución. La ejecución real puede ocurrir unos minutos tarde; el slot sigue siendo el de las 09:00.
 */
export function currentSlot(now: Date): DailySlot | null {
  const clock = madridClock(now);
  if (clock.hour < SLOT_HOUR || clock.hour >= SLOT_LATEST_HOUR) return null;
  return slotForDate(clock.date);
}

/**
 * Fin (excl.) de la ventana de comparación de un slot: las 09:00 del día anterior, con el mismo inicio.
 *   · Martes a sábado y domingo: lunes 00:00 → 09:00 de ayer (mismo corte del día anterior).
 *   · Lunes (cierre semanal): semana anterior lunes 00:00 → domingo 09:00, es decir, el último WEEK_TO_DATE.
 * La comparación empieza siempre en `periodStart`, así que ambas ventanas son de la MISMA semana.
 */
export function comparisonWindowEnd(slot: DailySlot): string {
  return `${addCalendarDays(slot.slotDate, -1)}T${String(SLOT_HOUR).padStart(2, "0")}:00:00`;
}
