import "server-only";

import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

export type CanonicalMotiveBreakdownRow = {
  restauranteId: number;
  categoria: string;
  count: number;
  restaurantTotal: number;
  restaurantPercent: number;
  networkCount: number;
  networkTotal: number;
  networkPercent: number;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchCanonicalMotiveBreakdown(
  startKey: string,
  endKey: string,
  restaurantIds: number[]
): Promise<CanonicalMotiveBreakdownRow[]> {
  if (restaurantIds.length === 0) return [];

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_motives_breakdown", {
    p_start: startKey,
    p_end: endKey,
    p_restaurant_ids: restaurantIds,
  });

  if (error) {
    throw new Error(`Supabase motive breakdown failed: ${error.message}`);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      restauranteId: num(row.restaurante_id),
      categoria: String(row.categoria ?? ""),
      count: num(row.motivo_count),
      restaurantTotal: num(row.restaurante_total_categorizadas),
      restaurantPercent: num(row.restaurante_percent),
      networkCount: num(row.network_motivo_count),
      networkTotal: num(row.network_total_categorizadas),
      networkPercent: num(row.network_percent),
    };
  });
}
