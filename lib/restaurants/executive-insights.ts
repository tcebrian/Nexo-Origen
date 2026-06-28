import type { ReputationOutlook } from "./reputation-outlook";
import type { RestaurantDetail } from "./types";

export type ExecutiveSnapshot = {
  headline: string;
  narrative: string;
  gapToTarget: number;
  satisfactionPct: number;
  periodSatisfactionPct: number;
  reviewsPerDay: number;
  onTarget: boolean;
};

export function buildExecutiveSnapshot(
  detail: RestaurantDetail,
  outlook: ReputationOutlook
): ExecutiveSnapshot {
  const stats = detail.periodStats;
  const gapToTarget = Math.max(0, detail.targetMedia - detail.currentMedia);
  const satisfactionPct =
    detail.totalReviews > 0
      ? Math.round((detail.positiveReviews / detail.totalReviews) * 100)
      : 0;
  const periodSatisfactionPct =
    stats.periodReviews > 0
      ? Math.round((stats.periodPositives / stats.periodReviews) * 100)
      : satisfactionPct;

  const periodBuckets = Math.max(detail.volumeSeries.length, detail.chartValues.length, 1);
  const reviewsPerDay =
    stats.periodReviews > 0
      ? Math.round((stats.periodReviews / periodBuckets) * 10) / 10
      : 0;

  const onTarget = detail.currentMedia >= detail.targetMedia;

  let headline: string;
  let narrative: string;

  if (outlook.positivesNeeded > 0) {
    headline = `Por debajo del objetivo · ${gapToTarget.toFixed(2)} pts de margen`;
    narrative = `${detail.name} necesita ${outlook.positivesNeeded} reseñas positivas para alcanzar ${detail.targetMedia.toFixed(1)}. En el periodo acumula ${stats.periodNegatives} negativas y ${stats.periodPositives} positivas (${periodSatisfactionPct}% satisfacción).`;
  } else if (outlook.negativesTolerance > 0) {
    headline = `En objetivo con colchón operativo`;
    narrative = `Media global ${detail.currentMedia.toFixed(2)} frente a objetivo ${detail.targetMedia.toFixed(1)}. Puede absorber ${outlook.negativesTolerance} reseñas negativas sin perder la meta. Protección reputacional al ${detail.protectionLevel}%.`;
  } else if (onTarget) {
    headline = `En objetivo · situación estable`;
    narrative = `El local mantiene ${detail.currentMedia.toFixed(2)} de media con ${detail.totalReviews} reseñas históricas. En el periodo: ${stats.periodReviews} opiniones y variación ${stats.mediaChange} en la media.`;
  } else {
    headline = `Requiere seguimiento operativo`;
    narrative = detail.primaryAction;
  }

  return {
    headline,
    narrative,
    gapToTarget,
    satisfactionPct,
    periodSatisfactionPct,
    reviewsPerDay,
    onTarget,
  };
}
