import "server-only";

import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

export type CanonicalBrandMetricsRow = {
  marcaId: number;
  marca: string;
  totalRestaurantes: number;
  totalResenas: number;
  ratingSum: number;
  media: number;
  positivas: number;
  neutras: number;
  negativas: number;
  atencion: number;
  positivePct: number;
  negativePct: number;
  onTargetCount: number;
  watchCount: number;
  criticalCount: number;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchCanonicalBrandMetrics(
  startKey: string,
  endKey: string,
  restaurantIds: number[]
): Promise<CanonicalBrandMetricsRow[]> {
  if (restaurantIds.length === 0) return [];

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_brand_metrics", {
    p_start: startKey,
    p_end: endKey,
    p_restaurant_ids: restaurantIds,
  });

  if (error) {
    throw new Error(`Supabase brand metrics failed: ${error.message}`);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      marcaId: num(row.marca_id),
      marca: String(row.marca ?? ""),
      totalRestaurantes: num(row.total_restaurantes),
      totalResenas: num(row.total_resenas),
      ratingSum: num(row.rating_sum),
      media: num(row.media_exacta),
      positivas: num(row.positivas),
      neutras: num(row.neutras),
      negativas: num(row.negativas),
      atencion: num(row.atencion),
      positivePct: num(row.positive_pct),
      negativePct: num(row.negative_pct),
      onTargetCount: num(row.on_target_count),
      watchCount: num(row.watch_count),
      criticalCount: num(row.critical_count),
    };
  });
}
