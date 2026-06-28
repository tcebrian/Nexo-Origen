import { buildAlertsFromResenas } from "@/lib/alerts/build-from-resenas";
import { loadPeriodData } from "@/lib/supabase/period-api";
import type { AlertsRepository } from "./repository";

export const supabaseAlertsRepository: AlertsRepository = {
  async list(query) {
    try {
      const period = await loadPeriodData(query.start, query.end);
      return buildAlertsFromResenas(
        period.resenas,
        period.aggregates.byRestaurante,
        period.analisisByResenaId
      );
    } catch (error) {
      console.error("[supabaseAlertsRepository.list]", error);
      return [];
    }
  },

  async resolvedCountThisWeek() {
    try {
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - 7);

      const periodMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - periodMs);

      const [current, previous] = await Promise.all([
        loadPeriodData(start, end),
        loadPeriodData(prevStart, prevEnd),
      ]);

      let resolved = 0;
      for (const metrics of current.aggregates.byRestaurante.values()) {
        const prev = previous.aggregates.byRestaurante.get(metrics.restauranteId);
        if (!prev) continue;
        const wasAtRisk = prev.operationalStatus !== "on_target";
        const nowOnTarget = metrics.operationalStatus === "on_target";
        const improved = metrics.media > prev.media + 0.02;
        if (wasAtRisk && nowOnTarget && improved) resolved += 1;
      }
      return resolved;
    } catch (error) {
      console.error("[supabaseAlertsRepository.resolvedCountThisWeek]", error);
      return 0;
    }
  },
};
