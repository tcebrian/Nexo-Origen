import "server-only";

import type { UserScope } from "@/lib/auth/types";
import {
  listReportableRestaurants,
  loadMonthlyReport,
  monthlyPeriod,
  resolveMonthlyTarget,
} from "@/lib/reports/monthly/data";
import { generateMonthlyPdf } from "@/lib/reports/monthly/pdf";
import {
  MAX_REPORT_OFFSET,
  monthParts,
  type MonthlyReportSource,
} from "@/lib/conversations/report-send";

/**
 * Cableado real del informe mensual para Conversations: reutiliza directamente
 * `loadMonthlyReport` + `generateMonthlyPdf` (los mismos que `GET
 * /api/informes/mensual/[id]`), sin llamada HTTP interna. El scope lo aplican
 * `resolveMonthlyTarget` y `loadMonthlyReport`.
 */
export function monthlyReportSource(scope: UserScope): MonthlyReportSource {
  return {
    async resolveTarget(restaurantId, offset) {
      const target = await resolveMonthlyTarget(restaurantId, offset, scope);
      return target ? { restaurantId: target.restaurantId, name: target.name, startKey: target.startKey } : null;
    },
    async generatePdf(restaurantId, offset) {
      const report = await loadMonthlyReport(restaurantId, offset, scope);
      if (!report) throw new Error("Informe no disponible");
      return generateMonthlyPdf(report);
    },
  };
}

export type ReportOptions = {
  reportTypes: { id: "monthly"; label: string }[];
  restaurants: { id: number; name: string; brand: string; city: string }[];
  /** `offset` 0 = último mes completo. */
  periods: { offset: number; label: string }[];
};

const PERIOD_OPTIONS = 12;

/** Opciones del selector de informes (restaurantes dentro del scope + últimos meses). */
export async function listReportOptions(scope: UserScope): Promise<ReportOptions> {
  const periods = Array.from({ length: Math.min(PERIOD_OPTIONS, MAX_REPORT_OFFSET + 1) }, (_, offset) => {
    const { month, year } = monthParts(monthlyPeriod(offset).startKey);
    return { offset, label: `${month} ${year}` };
  });
  return {
    reportTypes: [{ id: "monthly", label: "Informe mensual por restaurante" }],
    restaurants: await listReportableRestaurants(scope),
    periods,
  };
}
