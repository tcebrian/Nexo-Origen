import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { getMediaImpactForReview } from "@/lib/reviews/media-impact";
import { naturalWeekBounds } from "@/lib/reviews/weekly-media";
import {
  AlertNotReadyError,
  assertAlertDataComplete,
  waitForCompleteAnalysis,
  type WaitForAnalysisOptions,
} from "@/lib/alerts/negative-review/alert-readiness";
import { mapReportRowToAlertData } from "@/lib/templates/negative-review-alert/map-from-report-row";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Espera por defecto al análisis IA: la imagen se genera dentro de la función del webhook (`maxDuration` 60 s). */
export const DEFAULT_ANALYSIS_WAIT: WaitForAnalysisOptions = { timeoutMs: 25_000, intervalMs: 2_500 };

/**
 * Reseñas del restaurante en la semana natural (lunes–domingo) de la reseña. La media "antes → después" de la
 * alerta es la de ESA semana, acumulada hasta la reseña (mismo criterio que el periodo semanal del panel).
 * SIEMPRE filtrado por `restaurante_id`: nunca mezcla datos de otro local.
 */
async function loadWeekReviews(client: AdminClient, restauranteId: number, week: { start: string; end: string }): Promise<ResenaRow[]> {
  const { data, error } = await client
    .from("resenas")
    .select("id, review_id, restaurante_id, estrellas, fecha_resena, created_at")
    .eq("restaurante_id", restauranteId)
    .gte("fecha_resena", week.start)
    .lt("fecha_resena", week.end)
    .order("fecha_resena", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`negative-alert week failed (${error.code ?? "unknown"})`);
  return (data ?? []) as ResenaRow[];
}

/** Lectura única del análisis. Un error de consulta NO se confunde con "todavía no existe". */
async function loadAnalysis(client: AdminClient, reviewId: string): Promise<AnalisisIaRow | null> {
  const { data, error } = await client
    .from("analisis_ia")
    .select("review_id, resumen, motivo, impacto, recomendacion, riesgo, empleado_mencionado, sentimiento, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw new Error(`negative-alert analysis failed (${error.code ?? "unknown"})`);
  return ((data ?? [])[0] as AnalisisIaRow | undefined) ?? null;
}

/**
 * Construye el payload de la alerta PNG a partir de una única fila de
 * `resenas`, sin pasar por el pipeline de informes (pensado para rangos de
 * fechas con muchos restaurantes) — aquí ya sabemos el restaurante exacto
 * porque viene del webhook de inserción.
 *
 * Devuelve `null` si la reseña o su restaurante no existen. Lanza `AlertNotReadyError` si el análisis IA
 * no está completo tras la espera o falta cualquier dato obligatorio: una alerta incompleta no se genera.
 */
export async function buildAlertDataForResena(
  resenaId: number,
  options: { analysisWait?: WaitForAnalysisOptions } = {}
): Promise<NegativeReviewAlertData | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase admin client no configurado (falta SUPABASE_SERVICE_ROLE_KEY)");

  const { data: resena, error: resenaError } = await supabase
    .from("resenas")
    .select(
      "id, review_id, restaurante_id, autor, estrellas, comentario, fecha_resena, created_at, restaurante_nombre, direccion, ciudad"
    )
    .eq("id", resenaId)
    .maybeSingle();

  if (resenaError) throw new Error(`negative-alert review failed (${resenaError.code ?? "unknown"})`);
  if (!resena || resena.restaurante_id == null) return null;

  const { data: restaurante, error: restauranteError } = await supabase
    .from("restaurantes")
    .select("id, nombre, direccion, ciudad, empresa_id, marca_id")
    .eq("id", resena.restaurante_id)
    .maybeSingle();

  if (restauranteError) throw new Error(`negative-alert restaurant failed (${restauranteError.code ?? "unknown"})`);
  if (!restaurante) return null;

  // La marca sale SIEMPRE del restaurante de la reseña. Sin marca no hay plantilla correcta: `marcaToBrandId("")`
  // caería en Burger King, así que aquí se rechaza en vez de enviar una alerta con la marca equivocada.
  let marca = "";
  if (restaurante.marca_id != null) {
    const { data: marcaRow, error: marcaError } = await supabase
      .from("marcas")
      .select("nombre")
      .eq("id", restaurante.marca_id)
      .maybeSingle();
    if (marcaError) throw new Error(`negative-alert brand failed (${marcaError.code ?? "unknown"})`);
    marca = marcaRow?.nombre?.trim() ?? "";
  }
  if (!marca || marca.toLowerCase() === "otros") throw new AlertNotReadyError("invalid_scope", ["brand"]);
  const brand = marcaToBrandId(marca);

  // El análisis se une por review_id. Si ese identificador lo comparte otra reseña (otro local), el análisis
  // podría ser de otro restaurante: se rechaza (misma regla que SEC-007).
  if (resena.review_id == null || String(resena.review_id).trim() === "") {
    throw new AlertNotReadyError("invalid_scope", ["review_id"]);
  }
  const reviewId = String(resena.review_id);
  const { data: sameReviewId, error: sameReviewIdError } = await supabase
    .from("resenas")
    .select("id")
    .eq("review_id", reviewId)
    .limit(2);
  if (sameReviewIdError) throw new Error(`negative-alert scope failed (${sameReviewIdError.code ?? "unknown"})`);
  if ((sameReviewId ?? []).length > 1) throw new AlertNotReadyError("invalid_scope", ["review_id"]);

  const resenaRow = resena as ResenaRow;
  const week = naturalWeekBounds(String(resena.fecha_resena ?? resena.created_at ?? ""));
  if (!week) throw new AlertNotReadyError("incomplete_data", ["fecha"]);
  const weekRows = await loadWeekReviews(supabase, resena.restaurante_id, week);
  if (weekRows.some((row) => row.restaurante_id !== resena.restaurante_id)) {
    throw new AlertNotReadyError("invalid_scope", ["restaurante_id"]);
  }
  // Si la reseña no trae `fecha_resena` (usa `created_at`) puede no salir del filtro: se añade a mano.
  if (!weekRows.some((row) => row.id === resenaRow.id)) weekRows.push(resenaRow);
  const impact = getMediaImpactForReview(weekRows, resenaRow);
  if (!impact) throw new AlertNotReadyError("incomplete_data", ["media"]);

  // Reseña con texto: la alerta exige el análisis IA completo (se espera a que Make lo escriba). Reseña solo con
  // estrellas: no hay nada que analizar, se usa el análisis si existe y no se bloquea la alerta por su ausencia.
  const hasComment = Boolean(resena.comentario?.trim());
  const analisis = hasComment
    ? await waitForCompleteAnalysis(() => loadAnalysis(supabase, reviewId), options.analysisWait ?? DEFAULT_ANALYSIS_WAIT)
    : await loadAnalysis(supabase, reviewId);

  const restaurantName = restaurante.nombre?.trim() || resena.restaurante_nombre?.trim() || "Restaurante";
  const dateRaw = resena.fecha_resena ?? resena.created_at;
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const motive = classifyReviewReason(resenaRow, analisis);

  const row: NegativeReviewReportRow = {
    id: reviewId,
    restauranteId: restaurante.id,
    restaurant: restaurantName,
    restaurantSlug: restaurantSlug(restaurantName),
    brand,
    brandLabel: marca,
    city: restaurante.ciudad?.trim() || "",
    address: restaurante.direccion?.trim() || resena.direccion?.trim() || "—",
    author: resena.autor?.trim() || "Anónimo",
    dateIso: date.toISOString(),
    dateLabel: date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
    stars: resena.estrellas,
    comment: resena.comentario?.trim() || "Sin comentario",
    motive: motive === "Sin comentario" ? IA_NO_DATA : motive,
    detectedReasons: motive === "Otros" || motive === "Sin comentario" ? [] : [motive],
    sentiment: analisis?.sentimiento?.trim() || IA_NO_DATA,
    riskLevel: analisis?.riesgo?.trim() || IA_NO_DATA,
    aiSummary: analisis?.resumen?.trim() || null,
    analisisPending: false,
    mediaBefore: impact.mediaBefore,
    mediaAfter: impact.mediaAfter,
    impact: impact.impact,
    // Texto del análisis; nunca se sustituye por el delta numérico (eso ya lo muestra "Impacto en la media").
    impactText: analisis?.impacto?.trim() || IA_NO_DATA,
    recommendation: analisis?.recomendacion?.trim() || IA_NO_DATA,
    employeeMentioned: analisis?.empleado_mencionado?.trim() || null,
    reviewCountAfter: impact.reviewCountAfter,
    totalReviews: null,
    lifetimeMedia: null,
  };

  const data = mapReportRowToAlertData(row);
  assertAlertDataComplete(data, { requireAnalysis: hasComment });
  return data;
}
