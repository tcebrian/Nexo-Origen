export function formatAlertTime(date: string | null): string {
  if (!date) return "Sin fecha en el periodo";
  try {
    const hasTime = date.includes("T") && !date.endsWith("T00:00:00.000Z");
    const parsed = new Date(hasTime ? date : `${date.slice(0, 10)}T12:00:00`);
    const formatted = parsed.toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
    return `Reseña · ${formatted}`;
  } catch {
    return "Fecha registrada en Supabase";
  }
}

/** Tiempo relativo para listados compactos (ej. "Hace 2 horas"). */
export function formatRelativeAlertTime(date: string | null): string | null {
  if (!date) return null;
  try {
    const hasTime = date.includes("T") && !date.endsWith("T00:00:00.000Z");
    const parsed = new Date(hasTime ? date : `${date.slice(0, 10)}T12:00:00`);
    const diffMs = Date.now() - parsed.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return null;

    const mins = Math.max(1, Math.round(diffMs / 60000));
    if (mins < 60) return `Hace ${mins} min`;

    const hours = Math.round(mins / 60);
    if (hours < 24) return `Hace ${hours} hora${hours === 1 ? "" : "s"}`;

    const days = Math.round(hours / 24);
    return `Hace ${days} día${days === 1 ? "" : "s"}`;
  } catch {
    return null;
  }
}
