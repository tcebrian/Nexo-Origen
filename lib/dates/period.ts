/** Zona horaria de negocio para filtros de periodo. */
export const APP_TIMEZONE = "Europe/Madrid";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD en calendario de Madrid. */
export function toDateKey(input: Date | string): string {
  if (typeof input === "string" && DATE_KEY_RE.test(input)) {
    return input;
  }

  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(date);
}

/** Inicio del día local (Madrid) para una clave YYYY-MM-DD. */
export function parseDateKeyStart(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Fin del día local (Madrid) para una clave YYYY-MM-DD. */
export function parseDateKeyEnd(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function isValidDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value);
}

export function isDateKeyInRange(
  dateValue: string | null | undefined,
  startKey: string,
  endKey: string
): boolean {
  if (!dateValue) return false;
  const key = toDateKey(dateValue);
  if (!key) return false;
  return key >= startKey && key <= endKey;
}

export type PeriodKeys = {
  startKey: string;
  endKey: string;
};

export type PeriodBounds = PeriodKeys & {
  start: Date;
  end: Date;
};

export function getPeriodBounds(startKey: string, endKey: string): PeriodBounds {
  const [start, end] =
    startKey <= endKey ? [startKey, endKey] : [endKey, startKey];

  return {
    startKey: start,
    endKey: end,
    start: parseDateKeyStart(start),
    end: parseDateKeyEnd(end),
  };
}

export function getPeriodBoundsFromDates(start: Date, end: Date): PeriodBounds {
  return getPeriodBounds(toDateKey(start), toDateKey(end));
}

export function getDaysInPeriod(bounds: PeriodBounds): number {
  const start = parseDateKeyStart(bounds.startKey);
  const end = parseDateKeyStart(bounds.endKey);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
}
