// Ver nota en lib/translate/deepl.ts: sin "server-only" a propósito, este
// módulo se cuela en el bundle de cliente vía hooks "use client".
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { translateBatch } from "@/lib/translate/deepl";
import type { ResenaRow } from "@/lib/supabase/resenas";

export type ResenaTranslation = {
  text: string;
  detectedLanguage: string | null;
};

/**
 * Traducción al español de un lote de reseñas, con caché en
 * `resenas_traducciones` — cada reseña solo se manda a traducir una vez en
 * toda su vida, aunque se recargue la página muchas veces.
 * Si ya está en español (o no hay DEEPL_API_KEY configurada) no aparece en
 * el mapa devuelto, y el llamador debe usar el texto original tal cual.
 */
export async function getTranslationsForResenas(
  resenas: Pick<ResenaRow, "id" | "comentario">[]
): Promise<Map<string, ResenaTranslation>> {
  const result = new Map<string, ResenaTranslation>();
  const candidates = resenas.filter((row) => (row.comentario?.trim().length ?? 0) >= 3);
  if (candidates.length === 0) return result;

  const supabase = getSupabaseAdmin();
  if (!supabase) return result;

  const ids = candidates.map((row) => String(row.id));

  const { data: cached } = await supabase
    .from("resenas_traducciones")
    .select("resena_id, idioma_detectado, texto_traducido")
    .in("resena_id", ids);

  const cachedIds = new Set<string>();
  for (const row of cached ?? []) {
    cachedIds.add(String(row.resena_id));
    if ((row.idioma_detectado ?? "").toUpperCase() !== "ES") {
      result.set(String(row.resena_id), {
        text: row.texto_traducido,
        detectedLanguage: row.idioma_detectado,
      });
    }
  }

  const pending = candidates.filter((row) => !cachedIds.has(String(row.id)));
  if (pending.length === 0) return result;

  // DeepL admite hasta 50 textos por llamada.
  const BATCH_SIZE = 50;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const translations = await translateBatch(batch.map((row) => row.comentario ?? ""));
    if (!translations) break;

    const rowsToInsert = batch.map((row, idx) => ({
      resena_id: row.id,
      idioma_detectado: translations[idx]?.detectedSourceLanguage ?? null,
      texto_traducido: translations[idx]?.text ?? row.comentario ?? "",
    }));

    await supabase.from("resenas_traducciones").upsert(rowsToInsert, { onConflict: "resena_id" });

    for (const inserted of rowsToInsert) {
      if ((inserted.idioma_detectado ?? "").toUpperCase() !== "ES") {
        result.set(String(inserted.resena_id), {
          text: inserted.texto_traducido,
          detectedLanguage: inserted.idioma_detectado,
        });
      }
    }
  }

  return result;
}
