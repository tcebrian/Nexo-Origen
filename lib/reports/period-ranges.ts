import { toDateKey } from "../dates/period";

export type ReportPeriodSlug = "semanal" | "mensual" | "trimestral";

export const REPORT_PERIOD_SLUGS: ReportPeriodSlug[] = ["semanal", "mensual", "trimestral"];

export const REPORT_PERIOD_LABELS: Record<ReportPeriodSlug, string> = {
  semanal: "Informe semanal",
  mensual: "Informe mensual",
  trimestral: "Informe trimestral",
};

export function isReportPeriodSlug(value: string): value is ReportPeriodSlug {
  return (REPORT_PERIOD_SLUGS as string[]).includes(value);
}

export type ReportPeriodRange = {
  /** Primer día del periodo, como día de calendario a mediodía UTC (ver calendarDay). */
  start: Date;
  /** Último día del periodo, como día de calendario a mediodía UTC. */
  end: Date;
  /** Primer y último día (YYYY-MM-DD, calendario de Madrid): es lo que se consulta en Supabase. */
  startKey: string;
  endKey: string;
  /** "14 al 20 de septiembre de 2026" */
  label: string;
  /** Fecha compacta para nombres de archivo: "14-20 sept 2026". */
  fileLabel: string;
};

const DAY_MS = 86_400_000;

/**
 * Un día de calendario, sin hora, representado a mediodía UTC. Así el mismo
 * día sale igual en cualquier servidor (Vercel corre en UTC, tu ordenador en
 * Madrid). Antes el periodo se construía con la hora local del servidor y se
 * convertía a fecha en Madrid: en Vercel el "20 a las 23:59" UTC pasaba a ser
 * el 21 en Madrid y cada informe incluía un día de más (las reseñas del día
 * siguiente al periodo).
 */
function calendarDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MONTH_LONG = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });

function formatRangeLabel(start: Date, end: Date): string {
  const day = (d: Date) => String(d.getUTCDate()).padStart(2, "0");
  const month = (d: Date) => MONTH_LONG.format(d);
  const year = (d: Date) => d.getUTCFullYear();

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${day(start)} al ${day(end)} de ${month(end)} de ${year(end)}`;
  }
  if (sameYear) {
    return `${day(start)} de ${month(start)} al ${day(end)} de ${month(end)} de ${year(end)}`;
  }
  return `${day(start)} de ${month(start)} de ${year(start)} al ${day(end)} de ${month(end)} de ${year(end)}`;
}

function formatRangeFileLabel(start: Date, end: Date): string {
  const short = (d: Date) => MONTH_SHORT.format(d).replace(/\.$/, "");
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}-${end.getUTCDate()} ${short(end)} ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${start.getUTCDate()} ${short(start)}-${end.getUTCDate()} ${short(end)} ${end.getUTCFullYear()}`;
  }
  return `${start.getUTCDate()} ${short(start)} ${start.getUTCFullYear()}-${end.getUTCDate()} ${short(end)} ${end.getUTCFullYear()}`;
}

/**
 * Periodo natural (semana lun-dom / mes de calendario / trimestre de
 * calendario), siempre completo — nunca el que está en curso. `offset`
 * cuenta hacia atrás desde el último periodo completo: 0 = el anterior al
 * actual (p. ej. si hoy es miércoles de la semana del 24-30, offset 0 da
 * 17-23), 1 = uno más atrás, etc. Así "informe semanal" siempre corresponde
 * a una semana natural cerrada, igual que los que genera el usuario a mano.
 *
 * "Hoy" es el día de calendario de Madrid y todo el cálculo son fechas de
 * calendario: el resultado no depende de la zona horaria del servidor.
 */
export function resolveReportPeriodRange(
  slug: ReportPeriodSlug,
  offset: number = 0,
  now: Date = new Date()
): ReportPeriodRange {
  const stepsBack = Math.max(0, Math.floor(offset)) + 1;
  const [todayYear, todayMonth, todayDay] = toDateKey(now).split("-").map(Number);
  const today = calendarDay(todayYear, todayMonth - 1, todayDay);

  let start: Date;
  let end: Date;

  if (slug === "semanal") {
    const weekday = today.getUTCDay(); // 0 = domingo
    const currentWeekStart = addDays(today, weekday === 0 ? -6 : 1 - weekday);
    start = addDays(currentWeekStart, -7 * stepsBack);
    end = addDays(start, 6);
  } else if (slug === "mensual") {
    start = calendarDay(today.getUTCFullYear(), today.getUTCMonth() - stepsBack, 1);
    end = calendarDay(start.getUTCFullYear(), start.getUTCMonth() + 1, 0);
  } else {
    const quarterMonth = Math.floor(today.getUTCMonth() / 3) * 3;
    start = calendarDay(today.getUTCFullYear(), quarterMonth - 3 * stepsBack, 1);
    end = calendarDay(start.getUTCFullYear(), start.getUTCMonth() + 3, 0);
  }

  return {
    start,
    end,
    startKey: dayKey(start),
    endKey: dayKey(end),
    label: formatRangeLabel(start, end),
    fileLabel: formatRangeFileLabel(start, end),
  };
}
