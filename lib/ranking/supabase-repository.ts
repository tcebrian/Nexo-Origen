import { buildRestaurantSparkline } from "@/lib/supabase/chart-series";
import { metricsToRanking } from "@/lib/supabase/kpi-mappers";
import { loadPeriodData } from "@/lib/supabase/period-api";
import { sortRankingMetrics } from "@/lib/review-metrics";
import type { RankingRepository } from "./repository";

export const supabaseRankingRepository: RankingRepository = {
  async list(query) {
    try {
      const periodMs = query.end.getTime() - query.start.getTime();
      const prevEnd = new Date(query.start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - periodMs);

      const [current, previous] = await Promise.all([
        loadPeriodData(query.start, query.end),
        loadPeriodData(prevStart, prevEnd),
      ]);

      const rows = sortRankingMetrics(Array.from(current.aggregates.byRestaurante.values()));

      return rows.map((metrics) => {
        const prev = previous.aggregates.byRestaurante.get(metrics.restauranteId);
        const mediaChange =
          prev && metrics.totalResenas > 0
            ? parseFloat((metrics.media - prev.media).toFixed(2))
            : 0;
        const sparkline = buildRestaurantSparkline(
          current.kpiDiarioRows,
          current.resenas,
          metrics.restauranteId
        );
        return { ...metricsToRanking(metrics, mediaChange), sparkline };
      });
    } catch (error) {
      console.error("[supabaseRankingRepository.list]", error);
      return [];
    }
  },
};
