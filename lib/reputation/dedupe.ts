export type DedupableReviewRow = {
  id: number | string;
  review_id?: number | string | null;
  restaurante_id?: number | null;
  restaurante?: string | null;
  estrellas: number;
  fecha_resena?: string | null;
  created_at?: string | null;
  autor?: string | null;
  comentario?: string | null;
};

function normalizeReviewText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeReviewDateKey(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return value.trim().slice(0, 10);
}

/** Firma de contenido: mismo local + fecha + autor + estrellas + comentario. */
export function getReviewContentKey(row: DedupableReviewRow): string {
  const restauranteId = row.restaurante_id ?? 0;
  const restaurant = normalizeReviewText(row.restaurante);
  const fecha = normalizeReviewDateKey(row.fecha_resena ?? row.created_at);
  const autor = normalizeReviewText(row.autor);
  const comentario = normalizeReviewText(row.comentario);
  const estrellas = row.estrellas;

  if (!comentario && !autor) {
    return `row_id:${row.id}`;
  }

  return `content:${restauranteId}:${restaurant}:${fecha}:${autor}:${estrellas}:${comentario}`;
}

export function getReviewDedupKey(row: DedupableReviewRow): string {
  const reviewId = row.review_id != null ? String(row.review_id).trim() : "";
  if (reviewId) return `review_id:${reviewId}`;
  return getReviewContentKey(row);
}

function hasReviewId(row: DedupableReviewRow): boolean {
  return row.review_id != null && String(row.review_id).trim() !== "";
}

function reviewTimestamp(row: DedupableReviewRow): number {
  const value = row.fecha_resena ?? row.created_at;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function choosePreferredReview<T extends DedupableReviewRow>(existing: T, candidate: T): T {
  const existingHasReviewId = hasReviewId(existing);
  const candidateHasReviewId = hasReviewId(candidate);
  if (candidateHasReviewId && !existingHasReviewId) return candidate;
  if (existingHasReviewId && !candidateHasReviewId) return existing;

  const existingTime = reviewTimestamp(existing);
  const candidateTime = reviewTimestamp(candidate);
  if (candidateTime !== existingTime) {
    return candidateTime >= existingTime ? candidate : existing;
  }

  return Number(candidate.id) >= Number(existing.id) ? candidate : existing;
}

function dedupeWithKey<T extends DedupableReviewRow>(
  rows: T[],
  keyFn: (row: T) => string
): T[] {
  const byKey = new Map<string, T>();

  for (const row of rows) {
    const key = keyFn(row);
    const existing = byKey.get(key);
    byKey.set(key, existing ? choosePreferredReview(existing, row) : row);
  }

  return Array.from(byKey.values());
}

/**
 * Elimina duplicados:
 * 1) por review_id
 * 2) por contenido (misma reseña importada con otro review_id)
 */
export function dedupeResenas<T extends DedupableReviewRow>(rows: T[]): T[] {
  if (rows.length <= 1) return rows;

  const byReviewId = dedupeWithKey(rows, (row) => {
    const reviewId = row.review_id != null ? String(row.review_id).trim() : "";
    return reviewId ? `review_id:${reviewId}` : `row_id:${row.id}`;
  });

  return dedupeWithKey(byReviewId, getReviewContentKey);
}
