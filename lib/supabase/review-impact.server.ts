import "server-only";

import type { MediaImpactResult } from "@/lib/reviews/media-impact";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import type { ResenaRow } from "@/lib/supabase/resenas";

type ImpactRpcRow = {
  resena_id: number | string;
  restaurante_id: number | string;
  media_before: number | string | null;
  media_after: number | string;
  impact: number | string;
  review_count_before: number | string;
  review_count_after: number | string;
};

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchCanonicalReviewImpacts(
  resenas: ResenaRow[]
): Promise<Record<string, MediaImpactResult>> {
  const ids = [...new Set(resenas.map((row) => Number(row.id)).filter(Number.isFinite))];
  if (ids.length === 0) return {};

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_review_rating_impacts", {
    p_resena_ids: ids,
  });

  if (error) {
    console.error("[fetchCanonicalReviewImpacts]", error.message);
    return {};
  }

  return Object.fromEntries(
    ((data ?? []) as ImpactRpcRow[]).map((row) => [
      String(row.resena_id),
      {
        mediaBefore: row.media_before == null ? null : n(row.media_before),
        mediaAfter: n(row.media_after),
        impact: n(row.impact),
        reviewCountBefore: n(row.review_count_before),
        reviewCountAfter: n(row.review_count_after),
      } satisfies MediaImpactResult,
    ])
  );
}

export async function fetchCanonicalReviewImpactById(
  resenaId: number
): Promise<MediaImpactResult | null> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_review_rating_impacts", {
    p_resena_ids: [resenaId],
  });

  if (error) {
    console.error("[fetchCanonicalReviewImpactById]", error.message);
    return null;
  }

  const row = ((data ?? [])[0] ?? null) as ImpactRpcRow | null;
  if (!row) return null;

  return {
    mediaBefore: row.media_before == null ? null : n(row.media_before),
    mediaAfter: n(row.media_after),
    impact: n(row.impact),
    reviewCountBefore: n(row.review_count_before),
    reviewCountAfter: n(row.review_count_after),
  };
}
