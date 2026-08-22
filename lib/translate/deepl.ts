// No "server-only" aquí a propósito: lib/reviews/repository.ts y
// lib/alerts/repository.ts (que importan esto indirectamente) se cuelan en
// el bundle de cliente porque los usan hooks "use client" (use-reviews.ts,
// use-alerts.ts) — igual que restaurants-repository-shared.ts (ver
// CLAUDE.md). getSupabaseAdmin() ya se protege solo: sin
// SUPABASE_SERVICE_ROLE_KEY (nunca presente en el navegador) devuelve null
// y esta función no hace nada, así que no hay riesgo de fuga de la clave.

export type DeeplTranslation = {
  text: string;
  detectedSourceLanguage: string;
};

/**
 * Traduce varios textos a la vez en una sola llamada (DeepL soporta hasta
 * 50 textos por petición) — evita N llamadas secuenciales al traducir un
 * lote de reseñas.
 */
export async function translateBatch(texts: string[]): Promise<DeeplTranslation[] | null> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey || texts.length === 0) return null;

  // Las claves del plan gratuito terminan en ":fx" y usan el subdominio api-free.
  const host = apiKey.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";

  const body = new URLSearchParams();
  body.set("target_lang", "ES");
  for (const text of texts) body.append("text", text);

  const response = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    console.error("[deepl] translate failed", response.status, await response.text().catch(() => ""));
    return null;
  }

  const data = (await response.json()) as {
    translations: { text: string; detected_source_language: string }[];
  };

  return data.translations.map((t) => ({
    text: t.text,
    detectedSourceLanguage: t.detected_source_language,
  }));
}
