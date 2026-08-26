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

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

const DAYS_BACK: Record<ReportPeriodSlug, number> = {
  semanal: 6,
  mensual: 29,
  trimestral: 89,
};

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

/** Rango de "últimos N días" hasta hoy — no mes/trimestre natural. */
export function resolveReportPeriodRange(slug: ReportPeriodSlug, now: Date = new Date()): ReportPeriodRange {
  const end = endOfDay(now);
  const start = startOfDay(now);
  start.setDate(start.getDate() - DAYS_BACK[slug]);

  return { start, end, label: formatRangeLabel(start, end) };
}
