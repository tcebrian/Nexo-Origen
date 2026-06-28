import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { classifyReviewReason, classifyReviewReasons } from "@/lib/reviews/classify-reason";
import { resolveReviewIaFields } from "@/lib/reviews/map-analisis-ia";
import type { Review } from "@/lib/reviews/types";
import { reasonToCategory } from "@/lib/reviews/classify";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";

/** Fusiona fila analisis_ia en un Review ya mapeado (sin inventar datos). */
export function applyAnalisisToReview(review: Review, analisis: AnalisisIaRow | null): Review {
  const iaFields = resolveReviewIaFields(analisis, {
    rating: review.rating,
    mediaBefore: review.mediaBefore,
    mediaAfter: review.mediaAfter,
    mediaImpact: review.mediaImpact,
  });

  const primaryReason = classifyReviewReason(
    {
      comentario: review.text,
      resumen_ia: analisis?.resumen,
      analisis_ia: analisis?.motivo,
      recomendacion_ia: analisis?.recomendacion,
      empleado_mencionado: analisis?.empleado_mencionado,
    },
    analisis
  );
  const detectedReasons = classifyReviewReasons(
    {
      comentario: review.text,
      resumen_ia: analisis?.resumen,
      analisis_ia: analisis?.motivo,
      recomendacion_ia: analisis?.recomendacion,
      empleado_mencionado: analisis?.empleado_mencionado,
    },
    analisis
  );
  const category = reasonToCategory(primaryReason);

  const operationalSentiment =
    review.rating <= 2 ? "negativa" : review.rating === 3 ? "neutral" : "positiva";

  return {
    ...review,
    sentiment: iaFields.iaPending ? operationalSentiment : iaFields.sentiment,
    sentimentLabel: iaFields.sentimentLabel,
    motiveLabel: primaryReason,
    category,
    riskLevel: iaFields.riskLevel,
    impactLabel: iaFields.impactLabel,
    employeeMentioned: iaFields.employeeMentioned,
    iaPending: iaFields.iaPending,
    recommendedAction: iaFields.recommendedAction,
    estimatedImpact: iaFields.impactLabel,
    analyzed: iaFields.analyzed,
    ai: iaFields.ai
      ? {
          ...iaFields.ai,
          motives: [
            ...detectedReasons,
            ...iaFields.ai.motives.filter(
              (motive) =>
                !detectedReasons.includes(motive as (typeof detectedReasons)[number]) &&
                motive !== IA_NO_DATA
            ),
          ],
        }
      : iaFields.ai,
    priority: iaFields.ai?.priority ?? review.priority,
  };
}
