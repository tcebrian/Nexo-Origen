import {
  percentageOfTotal,
  weightedAverage,
} from "./aggregation";

export type ReputationSummaryStatus = "on_target" | "watch" | "critical";

export type ReputationSummaryItem = {
  media: number;
  reviews: number;
  positives: number;
  negatives: number;
  status?: ReputationSummaryStatus;
};

export type ReputationSummary = {
  media: number;
  reviews: number;
  positives: number;
  negatives: number;
  positivePct: number;
  negativePct: number;
  onTarget: number;
  watch: number;
  critical: number;
};

export function summarizeReputation(
  items: ReputationSummaryItem[]
): ReputationSummary {
  const reviews = items.reduce((sum, item) => sum + item.reviews, 0);
  const positives = items.reduce((sum, item) => sum + item.positives, 0);
  const negatives = items.reduce((sum, item) => sum + item.negatives, 0);

  return {
    media: weightedAverage(
      items.map((item) => ({ value: item.media, weight: item.reviews }))
    ),
    reviews,
    positives,
    negatives,
    positivePct: percentageOfTotal(positives, reviews),
    negativePct: percentageOfTotal(negatives, reviews),
    onTarget: items.filter((item) => item.status === "on_target").length,
    watch: items.filter((item) => item.status === "watch").length,
    critical: items.filter((item) => item.status === "critical").length,
  };
}

export function summarizeOperationalReputation(
  rows: Array<{
    currentMedia: number;
    totalReviews: number;
    positiveReviews: number;
    negativeReviews: number;
    status: ReputationSummaryStatus;
  }>
): ReputationSummary {
  return summarizeReputation(
    rows.map((row) => ({
      media: row.currentMedia,
      reviews: row.totalReviews,
      positives: row.positiveReviews,
      negatives: row.negativeReviews,
      status: row.status,
    }))
  );
}

export function summarizeKpiReputation(
  rows: Array<{
    media_total: number;
    total_resenas: number;
    resenas_positivas: number;
    resenas_negativas: number;
  }>
): ReputationSummary {
  return summarizeReputation(
    rows.map((row) => ({
      media: row.media_total,
      reviews: row.total_resenas,
      positives: row.resenas_positivas,
      negatives: row.resenas_negativas,
    }))
  );
}

export type ReputationRankingBase = {
  media: number;
  reviews: number;
  negatives: number;
};

export function toRankingReputationBase(input: {
  media: number;
  totalResenas: number;
  resenasNegativas: number;
}): ReputationRankingBase {
  return {
    media: input.media,
    reviews: input.totalResenas,
    negatives: input.resenasNegativas,
  };
}
