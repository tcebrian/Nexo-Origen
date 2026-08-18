import "server-only";

import { getInclusiveQueryBoundsFromDates } from "@/lib/date-utils";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";

export type WeeklyContext = {
  periodLabel: string;
  reviewsBefore: number;
  reviewsAfter: number;
  mediaBefore: number | null;
  mediaAfter: number | null;
};

/** Lunes de la semana natural (lunes–domingo) que contiene `date`. Misma convención que date-range-context.tsx. */
function mondayOfWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const diffToMonday = day === 0 ? 6 : day - 1;
  normalized.setDate(normalized.getDate() - diffToMonday);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatWeekLabel(start: Date, end: Date): string {
  const day = (d: Date) => d.getDate();
  const month = end.toLocaleDateString("es-ES", { month: "long" });
  const year = end.getFullYear();
  return `${day(start)} al ${day(end)} de ${month} de ${year}`;
}

function averageStars(rows: { estrellas: number }[]): number | null {
  if (rows.length === 0) return null;
  const sum = rows.reduce((acc, r) => acc + (r.estrellas || 0), 0);
  return sum / rows.length;
}

/**
 * Compara la semana natural (lunes–domingo) en la que cae la reseña con la
 * semana natural inmediatamente anterior, para un restaurante concreto.
 * Requiere una consulta a Supabase nueva (14 días) — solo se llama al
 * generar la imagen de una reseña, no para toda la lista del informe.
 */
export async function computeWeeklyContext(
  restauranteId: number,
  reviewDateIso: string
): Promise<WeeklyContext> {
  const reviewDate = new Date(reviewDateIso);
  const currentWeekStart = mondayOfWeek(Number.isNaN(reviewDate.getTime()) ? new Date() : reviewDate);
  const currentWeekEnd = addDays(currentWeekStart, 6);
  const previousWeekStart = addDays(currentWeekStart, -7);

  const queryBounds = getInclusiveQueryBoundsFromDates(previousWeekStart, currentWeekEnd);
  const rows = await fetchResenasForPeriodServer(
    { start: previousWeekStart, end: currentWeekEnd },
    { restauranteId, queryBounds }
  );

  const currentWeekStartKey = currentWeekStart.toISOString().slice(0, 10);
  const before: typeof rows = [];
  const after: typeof rows = [];

  for (const row of rows) {
    const dateKey = (row.fecha_resena ?? row.created_at ?? "").slice(0, 10);
    if (!dateKey) continue;
    if (dateKey >= currentWeekStartKey) {
      after.push(row);
    } else {
      before.push(row);
    }
  }

  return {
    periodLabel: formatWeekLabel(currentWeekStart, currentWeekEnd),
    reviewsBefore: before.length,
    reviewsAfter: after.length,
    mediaBefore: averageStars(before),
    mediaAfter: averageStars(after),
  };
}
