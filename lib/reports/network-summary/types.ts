export type NetworkSummaryLocationStatus = "on_target" | "watch" | "risk" | "no_reviews";

export type NetworkSummaryLocationRow = {
  name: string;
  brandLabel: string;
  rating: number | null;
  reviewCount: number;
  status: NetworkSummaryLocationStatus;
  statusLabel: string;
  /** Motivo negativo principal del restaurante en el periodo, o "Sin reseñas negativas". */
  mainNegativeMotive: string;
};

export type NetworkSummaryReasonSegment = {
  label: string;
  count: number;
  percent: number;
};

export type NetworkSummaryData = {
  groupId: string;
  groupLabel: string;
  groupSublabel?: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalLocations: number;
  totalReviews: number;
  positiveReviews: number;
  positivePercent: number;
  negativeReviews: number;
  negativePercent: number;
  weightedAverage: number;
  targetAverage: number;
  belowTargetCount: number;
  belowTargetLocations: string[];
  locations: NetworkSummaryLocationRow[];
  negativeReasons: NetworkSummaryReasonSegment[];
};
