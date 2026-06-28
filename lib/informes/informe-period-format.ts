import {
  getPeriodBounds,
  getDaysInPeriod,
  parseDateKeyEnd,
  parseDateKeyStart,
  toDateKey,
  type PeriodBounds,
} from "@/lib/dates/period";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parseKey(key: string): { day: number; month: number; year: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { day, month, year };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Ej: "2 – 8 junio 2026" */
export function formatInformePeriodTitle(bounds: PeriodBounds): string {
  const start = parseKey(bounds.startKey);
  const end = parseKey(bounds.endKey);

  if (bounds.startKey === bounds.endKey) {
    return `${start.day} ${capitalize(MONTHS_ES[start.month - 1])} ${start.year}`;
  }

  const sameMonth = start.month === end.month && start.year === end.year;
  if (sameMonth) {
    return `${start.day} – ${end.day} ${capitalize(MONTHS_ES[start.month - 1])} ${end.year}`;
  }

  return `${start.day} ${capitalize(MONTHS_ES[start.month - 1])} – ${end.day} ${capitalize(MONTHS_ES[end.month - 1])} ${end.year}`;
}

/** Ej: "02 – 08 JUNIO 2026" */
export function formatInformePeriodRange(bounds: PeriodBounds): string {
  const start = parseKey(bounds.startKey);
  const end = parseKey(bounds.endKey);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (bounds.startKey === bounds.endKey) {
    return `${pad(start.day)} ${MONTHS_ES[start.month - 1].toUpperCase()} ${start.year}`;
  }

  const sameMonth = start.month === end.month && start.year === end.year;
  if (sameMonth) {
    return `${pad(start.day)} – ${pad(end.day)} ${MONTHS_ES[start.month - 1].toUpperCase()} ${end.year}`;
  }

  return `${pad(start.day)} ${MONTHS_ES[start.month - 1].toUpperCase()} – ${pad(end.day)} ${MONTHS_ES[end.month - 1].toUpperCase()} ${end.year}`;
}

export function getPreviousPeriodBounds(bounds: PeriodBounds): PeriodBounds {
  const spanDays = getDaysInPeriod(bounds);
  const prevEnd = new Date(bounds.start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * 86400000);

  return getPeriodBounds(toDateKey(prevStart), toDateKey(prevEnd));
}

/**
 * Devuelve la etiqueta del periodo anterior para el KPI de variación.
 * Ej: bounds cuyo endKey es abril → "VS ABRIL"
 */
export function formatVariacionPeriodLabel(previousBounds: PeriodBounds): string {
  const end = parseKey(previousBounds.endKey);
  return `VS ${MONTHS_ES[end.month - 1].toUpperCase()}`;
}

export { parseDateKeyStart, parseDateKeyEnd };
