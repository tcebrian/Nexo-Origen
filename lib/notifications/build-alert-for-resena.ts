import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { getMediaImpactForReview } from "@/lib/reviews/media-impact";
import { mapReportRowToAlertData } from "@/lib/templates/negative-review-alert/map-from-report-row";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";

/**
 * Construye el payload de la alerta PNG a partir de una única fila de
 * `resenas`, sin pasar por el pipeline de informes (pensado para rangos de
 * fechas con muchos restaurantes) — aquí ya sabemos el restaurante exacto
 * porque viene del webhook de inserción.
 */
export async function buildAlertDataForResena(
  resenaId: number
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

  if (resenaError || !resena || resena.restaurante_id == null) return null;

  const { data: restaurante } = await supabase
    .from("restaurantes")
    .select("id, nombre, direccion, ciudad, empresa_id, marca_id")
    .eq("id", resena.restaurante_id)
    .maybeSingle();

  if (!restaurante) return null;

  let marcaNombre: string | undefined;
  if (restaurante.marca_id != null) {
    const { data: marcaRow } = await supabase
      .from("marcas")
      .select("nombre")
      .eq("id", restaurante.marca_id)
      .maybeSingle();
    marcaNombre = marcaRow?.nombre ?? undefined;
  }

  const { data: recentResenas } = await supabase
    .from("resenas")
    .select("id, review_id, restaurante_id, estrellas, fecha_resena, created_at")
    .eq("restaurante_id", resena.restaurante_id)
    .order("fecha_resena", { ascending: false })
    .limit(300);

  const resenaRow = resena as ResenaRow;
  const impact = getMediaImpactForReview((recentResenas as ResenaRow[]) ?? [resenaRow], resenaRow);

  let analisis: AnalisisIaRow | null = null;
  if (resena.review_id != null) {
    const { data: analisisRow } = await supabase
      .from("analisis_ia")
      .select(
        "review_id, resumen, motivo, impacto, recomendacion, riesgo, empleado_mencionado, sentimiento, created_at"
      )
      .eq("review_id", String(resena.review_id))
      .maybeSingle();
    analisis = analisisRow ?? null;
  }

  const marca = marcaNombre?.trim() || "";
  const brand = marcaToBrandId(marca);
  const restaurantName = restaurante.nombre?.trim() || resena.restaurante_nombre?.trim() || "Restaurante";
  const dateRaw = resena.fecha_resena ?? resena.created_at;
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const motive = classifyReviewReason(resenaRow, analisis);

  const row: NegativeReviewReportRow = {
    id: String(resena.review_id ?? resena.id),
    restauranteId: restaurante.id,
    restaurant: restaurantName,
    restaurantSlug: restaurantSlug(restaurantName),
    brand,
    brandLabel: marca || "Burger King",
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
    analisisPending: !analisis,
    mediaBefore: impact?.mediaBefore ?? null,
    mediaAfter: impact?.mediaAfter ?? null,
    impact: impact?.impact ?? null,
    impactText:
      analisis?.impacto?.trim() ||
      (impact
        ? `${impact.mediaBefore?.toFixed(2) ?? "—"} → ${impact.mediaAfter.toFixed(2)}`
        : IA_NO_DATA),
    recommendation: analisis?.recomendacion?.trim() || IA_NO_DATA,
    employeeMentioned: analisis?.empleado_mencionado?.trim() || null,
    reviewCountAfter: impact?.reviewCountAfter ?? null,
    totalReviews: null,
    lifetimeMedia: null,
  };

  return mapReportRowToAlertData(row);
}
