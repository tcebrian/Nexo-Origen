import "server-only";



import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

import type { ResenaRow } from "@/lib/supabase/resenas";

import {

  buildAnalisisIaIndex,

  getResenaLookupId,

  logAnalisisIaJoinStats,

  type AnalisisIaIndex,

  type AnalisisIaRow,

} from "./analisis-ia";

import { SUPABASE_TABLES } from "./tables";



function normalizeAnalisisRow(row: Record<string, unknown>): AnalisisIaRow | null {

  const reviewId = row.review_id ?? row.resena_id;

  if (reviewId == null || String(reviewId).trim() === "") return null;



  const pick = (key: string) => {

    const value = row[key];

    if (value == null) return null;

    const text = String(value).trim();

    return text || null;

  };



  return {

    review_id: String(reviewId).trim(),

    resumen: pick("resumen"),

    motivo: pick("motivo"),

    impacto: pick("impacto"),

    recomendacion: pick("recomendacion"),

    riesgo: pick("riesgo"),

    empleado_mencionado: pick("empleado_mencionado"),

    sentimiento: pick("sentimiento"),

    created_at: pick("created_at"),

  };

}



function chunk<T>(items: T[], size: number): T[][] {

  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {

    batches.push(items.slice(i, i + size));

  }

  return batches;

}



function expandReviewIdVariants(ids: string[]): (string | number)[] {

  const values = new Set<string | number>();

  for (const id of ids) {

    const trimmed = id.trim();

    if (!trimmed) continue;

    values.add(trimmed);

    const numeric = Number(trimmed);

    if (Number.isFinite(numeric) && !Number.isNaN(numeric)) {

      values.add(numeric);

    }

  }

  return [...values];

}



/** Carga análisis IA: `analisis_ia.review_id IN (resenas.review_id)`. */

export async function fetchAnalisisIaForReviewIds(ids: string[]): Promise<{

  rows: AnalisisIaRow[];

  error: string | null;

}> {

  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (unique.length === 0) return { rows: [], error: null };



  const client = await getSupabaseDataClientForServer();

  const rows: AnalisisIaRow[] = [];

  const seen = new Set<string>();

  let lastError: string | null = null;



  for (const batch of chunk(expandReviewIdVariants(unique), 150)) {

    const { data, error } = await client

      .from(SUPABASE_TABLES.analisis_ia)

      .select("*")

      .in("review_id", batch);



    if (error) {

      lastError = error.message;

      console.error("[fetchAnalisisIaForReviewIds] Supabase error:", {

        message: error.message,

        code: error.code,

        details: error.details,

        hint: error.hint,

        batchSize: batch.length,

      });

      continue;

    }



    for (const row of data ?? []) {

      const normalized = normalizeAnalisisRow(row as Record<string, unknown>);

      if (normalized && !seen.has(normalized.review_id)) {

        seen.add(normalized.review_id);

        rows.push(normalized);

      }

    }

  }



  return { rows, error: lastError };

}



/** @deprecated Alias interno — usar fetchAnalisisIaForReviewIds */

export async function fetchAnalisisIaForResenaIds(ids: string[]): Promise<AnalisisIaRow[]> {

  const { rows } = await fetchAnalisisIaForReviewIds(ids);

  return rows;

}



export async function fetchAnalisisIaForResenas(resenas: ResenaRow[]): Promise<AnalisisIaIndex> {

  const ids = resenas

    .map((row) => getResenaLookupId(row))

    .filter((id): id is string => id != null);



  const { rows, error } = await fetchAnalisisIaForReviewIds(ids);

  const index = buildAnalisisIaIndex(rows);



  logAnalisisIaJoinStats(resenas, index, "fetchAnalisisIaForResenas", {

    analisisRowsFetched: rows.length,

    supabaseError: error,

  });



  return index;

}



/** Consulta directa: `analisis_ia.review_id = resenas.review_id`. */

export async function fetchAnalisisIaByReviewId(

  reviewId: string

): Promise<{ analisis: AnalisisIaRow | null; error: string | null }> {

  const id = reviewId.trim();

  if (!id) {

    return { analisis: null, error: "review_id vacío" };

  }



  const client = await getSupabaseDataClientForServer();

  const variants = expandReviewIdVariants([id]);



  for (const value of variants) {

    const { data, error } = await client

      .from(SUPABASE_TABLES.analisis_ia)

      .select("*")

      .eq("review_id", value)

      .limit(1);



    if (error) {

      console.error("[fetchAnalisisIaByReviewId] Supabase error:", {

        message: error.message,

        code: error.code,

        details: error.details,

        hint: error.hint,

        review_id: id,

        variant: value,

      });

      return { analisis: null, error: error.message };

    }



    const row = data?.[0];

    if (!row) continue;



    const normalized = normalizeAnalisisRow(row as Record<string, unknown>);

    if (normalized) {
      return { analisis: normalized, error: null };
    }
  }

  return { analisis: null, error: null };

}


