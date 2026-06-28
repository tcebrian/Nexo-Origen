import { dedupeResenas } from "@/lib/review-metrics";
import { REPUTATION_TARGET } from "@/lib/review-metrics";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { computeNegativesTolerance } from "@/lib/prevent/calculate";
import { getTargetProgress } from "./reputation-math";

/** Protección reputacional derivada de media, volumen y margen negativo real. */
export function computeProtectionLevel(
  media: number,
  totalReviews: number,
  target = REPUTATION_TARGET
): number {
  if (totalReviews <= 0) return 0;

  if (media >= target) {
    const tolerance = computeNegativesTolerance(media, totalReviews, target);
    return Math.min(99, Math.round(78 + Math.min(tolerance, 15) * 1.4));
  }

  const progress = getTargetProgress(media, target);
  return Math.max(5, Math.min(70, Math.round(progress * 0.7)));
}

/** NPS aproximado: % promotores (5★) − % detractores (≤3★). */
export function computeNpsFromResenas(resenas: ResenaRow[]): number {
  const rows = dedupeResenas(resenas);
  if (rows.length === 0) return 0;

  const promoters = rows.filter((row) => row.estrellas >= 5).length;
  const detractors = rows.filter((row) => row.estrellas <= 3).length;
  return Math.round(((promoters - detractors) / rows.length) * 100);
}

export function sortResenasByDateDesc<
  T extends { fecha_resena?: string | null; created_at?: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = a.fecha_resena ?? a.created_at ?? "";
    const db = b.fecha_resena ?? b.created_at ?? "";
    return db.localeCompare(da);
  });
}
