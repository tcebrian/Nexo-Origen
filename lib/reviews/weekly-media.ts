/**
 * Semana natural (lunes–domingo) que contiene una fecha, como `[start, end)` en `YYYY-MM-DD`.
 * Usa el día tal cual está guardado en `fecha_resena` (sin zona horaria), el mismo que se pinta en la imagen.
 */
export function naturalWeekBounds(dateIso: string): { start: string; end: string } | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!day) return null;
  const date = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
  if (Number.isNaN(date.getTime())) return null;
  const sinceMonday = (date.getUTCDay() + 6) % 7; // lunes = 0 … domingo = 6
  const start = new Date(date.getTime() - sinceMonday * 86_400_000);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
