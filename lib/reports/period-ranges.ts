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

export type ReportPeriodRange = { start: Date; end: Date; label: string };

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** Lunes de la semana natural (lun-dom) a la que pertenece `date`. */
function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMonday);
  return copy;
}

function startOfMonth(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfQuarter(date: Date): Date {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  const copy = new Date(date.getFullYear(), quarterMonth, 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatRangeLabel(start: Date, end: Date): string {
  const day = (d: Date) => d.toLocaleDateString("es-ES", { day: "2-digit" });
  const month = (d: Date) => d.toLocaleDateString("es-ES", { month: "long" });
  const year = (d: Date) => d.getFullYear();

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${day(start)} al ${day(end)} de ${month(end)} de ${year(end)}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${day(start)} de ${month(start)} al ${day(end)} de ${month(end)} de ${year(end)}`;
  }
  return `${day(start)} de ${month(start)} de ${year(start)} al ${day(end)} de ${month(end)} de ${year(end)}`;
}

/**
 * Periodo natural (semana lun-dom / mes de calendario / trimestre de
 * calendario), siempre completo — nunca el que está en curso. `offset`
 * cuenta hacia atrás desde el último periodo completo: 0 = el anterior al
 * actual (p. ej. si hoy es miércoles de la semana del 24-30, offset 0 da
 * 17-23), 1 = uno más atrás, etc. Así "informe semanal" siempre corresponde
 * a una semana natural cerrada, igual que los que genera el usuario a mano.
 */
export function resolveReportPeriodRange(
  slug: ReportPeriodSlug,
  offset: number = 0,
  now: Date = new Date()
): ReportPeriodRange {
  const stepsBack = Math.max(0, Math.floor(offset)) + 1;
  let start: Date;
  let end: Date;

  if (slug === "semanal") {
    const currentWeekStart = startOfWeekMonday(now);
    start = new Date(currentWeekStart);
    start.setDate(start.getDate() - 7 * stepsBack);
    const rawEnd = new Date(start);
    rawEnd.setDate(rawEnd.getDate() + 6);
    end = endOfDay(rawEnd);
  } else if (slug === "mensual") {
    const currentMonthStart = startOfMonth(now);
    start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - stepsBack, 1);
    end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));
  } else {
    const currentQuarterStart = startOfQuarter(now);
    start = new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() - 3 * stepsBack, 1);
    end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 3, 0));
  }

  return { start, end, label: formatRangeLabel(start, end) };
}
