export type ReviewActivityRow = {
  editada?: boolean | null;
  fecha_ultima_edicion?: string | null;
  fecha_resena?: string | null;
  created_at?: string | null;
};

/**
 * Fecha de actividad de una reseña: si fue editada y tiene fecha de última
 * edición, esa; si no, la fecha original (o created_at como último recurso).
 */
export function getResenaActivityDateValue(row: ReviewActivityRow): string | null {
  if (row.editada === true && row.fecha_ultima_edicion) return row.fecha_ultima_edicion;
  return row.fecha_resena ?? row.created_at ?? null;
}
