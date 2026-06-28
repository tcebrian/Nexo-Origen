import type { ResenaRow } from "@/lib/supabase/resenas";



export type AnalisisIaRow = {

  review_id: string;

  resumen: string | null;

  motivo: string | null;

  impacto: string | null;

  recomendacion: string | null;

  riesgo: string | null;

  empleado_mencionado: string | null;

  sentimiento: string | null;

  created_at: string | null;

};



export type AnalisisIaIndex = Map<string, AnalisisIaRow>;



/** Variantes de clave para emparejar string/number entre review_id de ambas tablas. */

function lookupKeyVariants(id: string): string[] {

  const trimmed = id.trim();

  if (!trimmed) return [];

  const keys = new Set<string>([trimmed]);

  const numeric = Number(trimmed);

  if (Number.isFinite(numeric) && !Number.isNaN(numeric)) {

    keys.add(String(numeric));

  }

  return [...keys];

}



/**

 * Clave de unión: `analisis_ia.review_id = resenas.review_id`.

 * No usar `resenas.id` ni columnas legacy `resena_id`.

 */

export function getResenaLookupId(row: Pick<ResenaRow, "review_id">): string | null {

  if (row.review_id == null) return null;

  const id = String(row.review_id).trim();

  return id || null;

}



export function buildAnalisisIaIndex(rows: AnalisisIaRow[]): AnalisisIaIndex {

  const index: AnalisisIaIndex = new Map();

  for (const row of rows) {

    for (const key of lookupKeyVariants(row.review_id)) {

      index.set(key, row);

    }

  }

  return index;

}



export function getAnalisisForResena(

  index: AnalisisIaIndex,

  row: Pick<ResenaRow, "review_id">

): AnalisisIaRow | null {

  const lookupId = getResenaLookupId(row);

  if (!lookupId) return null;



  for (const key of lookupKeyVariants(lookupId)) {

    const hit = index.get(key);

    if (hit) return hit;

  }



  return null;

}



/** Logs temporales: reseñas cargadas vs análisis unidos por review_id. */

export function logAnalisisIaJoinStats(

  resenas: ResenaRow[],

  index: AnalisisIaIndex,

  context: string,

  extra?: { analisisRowsFetched?: number; supabaseError?: string | null }

): void {
  if (process.env.NODE_ENV === "production") return;

  const resenasConReviewId = resenas.filter((row) => getResenaLookupId(row) != null).length;

  const resenasConAnalisis = resenas.filter((row) => getAnalisisForResena(index, row) != null).length;



  console.log(`[analisis_ia][${context}]`, {

    totalResenas: resenas.length,

    resenasConReviewId,

    totalAnalisisCargados: extra?.analisisRowsFetched ?? index.size,

    totalAnalisisEnIndice: index.size,

    resenasConAnalisisUnido: resenasConAnalisis,

    supabaseError: extra?.supabaseError ?? null,

  });

}


