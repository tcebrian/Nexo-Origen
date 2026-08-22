import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { dedupeResenas, getReviewDedupKey } from "@/lib/review-metrics";
import type { RestaurantPeriodMetrics } from "@/lib/review-metrics";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { getAnalisisForResena } from "@/lib/supabase/analisis-ia";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { resolveBrandId } from "@/lib/restaurants/brand-resolve";
import { formatImpactSummary } from "@/lib/reviews/impact-display";
import { buildMediaImpactIndex } from "@/lib/reviews/media-impact";
import type { ResenaTranslation } from "@/lib/translate/resena-translations";
import type { RestaurantAlert } from "./types";

export function buildAlertsFromResenas(
  resenas: ResenaRow[],
  metricsById: Map<number, RestaurantPeriodMetrics>,
  analisisByResenaId: AnalisisIaIndex = new Map(),
  translationsByResenaId: Map<string, ResenaTranslation> = new Map()
): RestaurantAlert[] {
  const uniqueResenas = dedupeResenas(resenas);
  const impactIndex = buildMediaImpactIndex(uniqueResenas);

  return uniqueResenas
    .filter((row) => row.estrellas <= 3)
    .map((row) => {
      const restauranteId = row.restaurante_id ?? 0;
      const metrics = metricsById.get(restauranteId);
      const restaurant = row.restaurante ?? metrics?.restaurante ?? "Restaurante";
      const marca = metrics?.marca ?? row.marca ?? "";
      const slug = restaurantSlug(restaurant);
      const brand =
        metrics?.brand ?? resolveBrandId(row.restaurante_id, marca, metricsById);
      const translation = translationsByResenaId.get(String(row.id));
      const text = translation?.text.trim() || row.comentario?.trim() || "Sin comentario";
      const analisis = getAnalisisForResena(analisisByResenaId, row);
      const mainMotive = classifyReviewReason(row, analisis);
      const motives = mainMotive === "Otros" || mainMotive === "Sin comentario" ? [] : [mainMotive];
      const dateValue = row.fecha_resena ?? row.created_at;
      const impact = impactIndex.get(getReviewDedupKey(row));

      let status: RestaurantAlert["status"] = "seguimiento";
      if (row.estrellas <= 2) status = "critico";
      else if (row.estrellas === 3) status = "seguimiento";

      const recommendation = analisis?.recomendacion?.trim() || IA_NO_DATA;
      const estimatedImpact =
        analisis?.impacto?.trim() ||
        (impact ? formatImpactSummary(impact).deltaLong : IA_NO_DATA);

      return {
        id: `review-${row.review_id ?? row.id}`,
        restaurant,
        restaurantSlug: slug,
        brand,
        status,
        activeAlerts: 1,
        mediaBefore: impact?.mediaBefore ?? null,
        mediaAfter: impact?.mediaAfter ?? metrics?.media ?? 0,
        mainMotive,
        detectedAt: dateValue ? new Date(dateValue) : new Date(),
        affectedReviews: 1,
        whatHappened: text,
        estimatedImpact,
        motives:
          motives.length > 0
            ? motives.map((name) => ({ name, percentage: 100 }))
            : mainMotive !== "Sin comentario"
              ? [{ name: mainMotive, percentage: 100 }]
              : [{ name: IA_NO_DATA, percentage: 100 }],
        recommendation,
        iaPending: !analisis,
      };
    })
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
}
