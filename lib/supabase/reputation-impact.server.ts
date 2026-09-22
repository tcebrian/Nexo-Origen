import "server-only";

import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

export type CanonicalReviewImpact = {
  resenaId: number;
  reviewId: string;
  restauranteId: number;
  mediaBefore: number | null;
  mediaAfter: number | null;
  impact: number | null;
  reviewsBefore: number;
  reviewsAfter: number;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchCanonicalReviewImpacts(
  resenaIds: number[]
): Promise<Map<number, CanonicalReviewImpact>> {
  const unique = [...new Set(resenaIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return new Map();

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_review_rating_impacts", {
    p_resena_ids: unique,
  });

  if (error) {
    throw new Error(`Supabase canonical review impact failed: ${error.message}`);
  }

  const map = new Map<number, CanonicalReviewImpact>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const resenaId = num(row.resena_id);
    if (!resenaId) continue;
    map.set(resenaId, {
      resenaId,
      reviewId: String(row.review_id ?? ""),
      restauranteId: num(row.restaurante_id),
      mediaBefore: nullableNum(row.media_before),
      mediaAfter: nullableNum(row.media_after),
      impact: nullableNum(row.impact),
      reviewsBefore: num(row.reviews_before),
      reviewsAfter: num(row.reviews_after),
    });
  }

  return map;
}
