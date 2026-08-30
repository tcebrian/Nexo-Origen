import "server-only";

import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { buildResenaMotivoIndex, type ResenaMotivoIndex, type ResenaMotivoRow } from "./resena-motivos";
import { SUPABASE_TABLES } from "./tables";

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function normalizeRow(row: Record<string, unknown>): ResenaMotivoRow | null {
  const reviewId = row.review_id;
  const categoria = row.categoria;
  if (reviewId == null || String(reviewId).trim() === "") return null;
  if (categoria == null || String(categoria).trim() === "") return null;
  return { review_id: String(reviewId).trim(), categoria: String(categoria).trim() };
}

/** Carga `resena_motivos.categoria`: `resena_motivos.review_id IN (resenas.review_id)`. */
export async function fetchResenaMotivosForReviewIds(ids: string[]): Promise<{
  rows: ResenaMotivoRow[];
  error: string | null;
}> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return { rows: [], error: null };

  const client = await getSupabaseDataClientForServer();
  const rows: ResenaMotivoRow[] = [];
  const seen = new Set<string>();
  let lastError: string | null = null;

  for (const batch of chunk(unique, 150)) {
    const { data, error } = await client
      .from(SUPABASE_TABLES.resena_motivos)
      .select("review_id, categoria")
      .in("review_id", batch);

    if (error) {
      lastError = error.message;
      console.error("[fetchResenaMotivosForReviewIds] Supabase error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        batchSize: batch.length,
      });
      continue;
    }

    for (const row of data ?? []) {
      const normalized = normalizeRow(row as Record<string, unknown>);
      if (normalized && !seen.has(normalized.review_id)) {
        seen.add(normalized.review_id);
        rows.push(normalized);
      }
    }
  }

  return { rows, error: lastError };
}

export async function fetchResenaMotivosForResenas(resenas: ResenaRow[]): Promise<ResenaMotivoIndex> {
  const ids = resenas
    .map((row) => (row.review_id != null ? String(row.review_id).trim() : ""))
    .filter((id) => id.length > 0);

  const { rows } = await fetchResenaMotivosForReviewIds(ids);
  return buildResenaMotivoIndex(rows);
}
