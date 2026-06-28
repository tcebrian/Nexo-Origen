import { dedupeResenas, getReviewDedupKey } from "@/lib/review-metrics";
import { formatImpactCompact } from "@/lib/reviews/impact-display";
import type { ResenaRow } from "@/lib/supabase/resenas";

export type MediaImpactResult = {
  mediaBefore: number | null;
  mediaAfter: number;
  impact: number;
  reviewCountBefore: number;
  reviewCountAfter: number;
};

function getReviewSortTime(row: ResenaRow): number {
  const raw = row.fecha_resena ?? row.created_at;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortReviewsChronologically(rows: ResenaRow[]): ResenaRow[] {
  return [...rows].sort((a, b) => {
    const timeDiff = getReviewSortTime(a) - getReviewSortTime(b);
    if (timeDiff !== 0) return timeDiff;
    return getReviewDedupKey(a).localeCompare(getReviewDedupKey(b));
  });
}

/**
 * Media acumulada del restaurante antes y después de cada reseña (orden cronológico).
 * mediaBefore = media de todas las reseñas anteriores en el periodo.
 * mediaAfter = media incluyendo la reseña actual.
 */
export function buildMediaImpactIndex(resenas: ResenaRow[]): Map<string, MediaImpactResult> {
  const index = new Map<string, MediaImpactResult>();
  const byRestaurant = new Map<number, ResenaRow[]>();

  for (const row of dedupeResenas(resenas)) {
    if (row.restaurante_id == null) continue;
    const list = byRestaurant.get(row.restaurante_id) ?? [];
    list.push(row);
    byRestaurant.set(row.restaurante_id, list);
  }

  for (const rows of byRestaurant.values()) {
    const sorted = sortReviewsChronologically(rows);
    let sum = 0;
    let count = 0;

    for (const row of sorted) {
      const mediaBefore = count > 0 ? sum / count : null;
      sum += row.estrellas;
      count += 1;
      const mediaAfter = sum / count;
      const impact = mediaBefore != null ? mediaAfter - mediaBefore : 0;

      index.set(getReviewDedupKey(row), {
        mediaBefore,
        mediaAfter,
        impact,
        reviewCountBefore: count - 1,
        reviewCountAfter: count,
      });
    }
  }

  return index;
}

export function getMediaImpactForReview(
  resenas: ResenaRow[],
  row: ResenaRow
): MediaImpactResult | null {
  const index = buildMediaImpactIndex(resenas);
  return index.get(getReviewDedupKey(row)) ?? null;
}

export function formatMediaImpactRange(result: MediaImpactResult): string {
  if (result.mediaBefore == null) {
    return `— → ${result.mediaAfter.toFixed(2)}`;
  }
  return `${result.mediaBefore.toFixed(2)} → ${result.mediaAfter.toFixed(2)}`;
}

export function formatMediaImpactDelta(result: MediaImpactResult): string {
  if (result.mediaBefore == null) {
    return result.mediaAfter.toFixed(2);
  }
  const sign = result.impact >= 0 ? "+" : "";
  return `${sign}${result.impact.toFixed(2)}`;
}

export function formatEstimatedImpactLabel(result: MediaImpactResult | null | undefined): string {
  if (!result) return "Sin datos de media en el periodo";
  return formatImpactCompact(result, 2);
}
