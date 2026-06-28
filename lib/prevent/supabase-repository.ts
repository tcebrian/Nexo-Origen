import { buildPreventRecord } from "@/lib/prevent/calculate";
import { loadPeriodData } from "@/lib/supabase/period-api";
import type { PreventRepository } from "./repository";

export const supabasePreventRepository: PreventRepository = {
  async list(query) {
    try {
      const period = await loadPeriodData(query.start, query.end);
      return Array.from(period.aggregates.byRestaurante.values()).map((metrics) =>
        buildPreventRecord(
          metrics.restaurante,
          metrics.slug,
          metrics.brand,
          metrics.media,
          metrics.totalResenas
        )
      );
    } catch (error) {
      console.error("[supabasePreventRepository.list]", error);
      return [];
    }
  },
};
