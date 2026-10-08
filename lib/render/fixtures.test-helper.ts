import type { MonthlyReportData } from "@/lib/reports/monthly/data";
import { SAMPLE_NEGATIVE_REVIEW_ALERT } from "@/lib/templates/negative-review-alert/sample-data";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";

/** Datos inventados y válidos para probar el renderer sin base de datos. */
export const SECRET = "nexo-render-secret-0123456789abcdef";

export function sampleMonthlyReport(): MonthlyReportData {
  const metrics = {
    restaurante_id: 7,
    total_resenas: 120,
    rating_sum: 520,
    media_exacta: 4.33,
    positivas: 90,
    neutras: 18,
    negativas: 12,
    atencion: 14,
    stars_1: 4,
    stars_2: 8,
    stars_3: 18,
    stars_4: 30,
    stars_5: 60,
    ultima_resena: "2026-09-29",
    operational_status: "ok",
    source: "canonical",
  };
  return {
    restaurant: {
      id: 7,
      name: "Burger King Zizur",
      brand: "Burger King",
      city: "Zizur",
      address: "Calle Falsa 1",
      company: "Grupo Prueba",
      target: 4.4,
      total: 900,
      average: 4.3,
    },
    label: "Septiembre 2026",
    startKey: "2026-09-01",
    endKey: "2026-09-30",
    current: metrics as never,
    previous: { ...metrics, total_resenas: 100 } as never,
    weeks: [
      { label: "S1", startKey: "2026-09-01", endKey: "2026-09-07", total: 30, average: 4.2, positive: 22, neutral: 5, negative: 3, stars: [1, 2, 3, 8, 16] },
    ],
    reviews: [{ id: "r1", author: "Ana", date: "2026-09-02", editedAt: null, stars: 2, comment: "Tardaron mucho", reason: "Tiempo de espera" }],
    reasons: [{ label: "Tiempo de espera", count: 4, percent: 33 }],
    criticalMaxStars: 2,
    criticalReasons: [{ label: "Tiempo de espera", count: 4, causal: true }],
  };
}

export function sampleAlert(over: Partial<NegativeReviewAlertData> = {}): NegativeReviewAlertData {
  return { ...SAMPLE_NEGATIVE_REVIEW_ALERT, ...over };
}
