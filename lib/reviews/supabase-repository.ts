import { dedupeResenas } from "@/lib/review-metrics";
import { sortResenasByDateDesc } from "@/lib/restaurants/reputation-metrics";
import { logAnalisisIaJoinStats } from "@/lib/supabase/analisis-ia";
import { mapResenasToReviews } from "@/lib/supabase/resenas";
import { loadPeriodData } from "@/lib/supabase/period-api";
import { getTranslationsForResenas } from "@/lib/translate/resena-translations";
import type { ReviewsRepository } from "./repository";

export const supabaseReviewsRepository: ReviewsRepository = {
  async list(query) {
    try {
      const period = await loadPeriodData(query.start, query.end);
      const resenas = sortResenasByDateDesc(dedupeResenas(period.resenas));

      logAnalisisIaJoinStats(resenas, period.analisisByResenaId, "supabaseReviewsRepository.list");

      const translationsByResenaId = await getTranslationsForResenas(resenas);

      return mapResenasToReviews(resenas, period.catalog, {
        impactIndex: period.impactByResenaId,
        analisisByResenaId: period.analisisByResenaId,
        translationsByResenaId,
      });
    } catch (error) {
      console.error("[supabaseReviewsRepository.list]", error);
      return [];
    }
  },
};