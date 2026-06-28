import { loadPeriodData } from "@/lib/supabase/period-api";
import { buildTalentoPayload, dedupeResenasForTalento } from "./build-from-resenas";
import type { TalentoPayload } from "./types";
import type { TalentoRepository } from "./repository";

export const supabaseTalentoRepository: TalentoRepository = {
  async listEmployees(query) {
    try {
      const periodMs = query.end.getTime() - query.start.getTime();
      const prevEnd = new Date(query.start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - periodMs);

      const [current, previous] = await Promise.all([
        loadPeriodData(query.start, query.end),
        loadPeriodData(prevStart, prevEnd).catch(() => null),
      ]);

      const payload: TalentoPayload = buildTalentoPayload(
        dedupeResenasForTalento(current.resenas),
        current.activeKpiRows,
        previous ? dedupeResenasForTalento(previous.resenas) : [],
        current.analisisByResenaId,
        previous?.analisisByResenaId ?? new Map()
      );
      return payload;
    } catch (error) {
      console.error("[supabaseTalentoRepository.listEmployees]", error);
      return {
        employees: [],
        summaryTrends: {
          employeesMentionedDelta: 0,
          positiveMentionsDelta: 0,
          negativeMentionsDelta: 0,
        },
      };
    }
  },
};
