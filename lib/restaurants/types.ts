import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type OperationalStatus = "on_target" | "watch" | "critical";

export type HealthStatus = "protected" | "watch" | "risk";

export type RestaurantSort = "risk" | "media-desc" | "media-asc" | "alerts-desc" | "name-asc";

export type RestaurantFilters = {
  company: string;
  brand: "todas" | BrandId;
  status: "todos" | OperationalStatus;
  search: string;
  sort: RestaurantSort;
};

export type NetworkStatusSummary = {
  total: number;
  onTarget: number;
  onWatch: number;
  critical: number;
  onTargetPct: number;
  onWatchPct: number;
  criticalPct: number;
  networkAverage: number;
  targetMedia: number;
};

export type RestaurantOperational = {
  id: string;
  slug: string;
  name: string;
  location: string;
  brand: BrandId;
  brandLabel: string;
  currentMedia: number;
  targetMedia: number;
  status: OperationalStatus;
  statusLabel: "En objetivo" | "Vigilancia" | "Riesgo";
  protectionLevel: number;
  activeAlerts: number;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  recommendedPositiveReviews: number;
  negativeBuffer: number;
  recommendedAction: string;
  trend: "up" | "flat" | "down";
  /** Evolución diaria de media (kpi_diario o reseñas). */
  sparkline: number[];
  /** Fecha ISO de la última reseña en el periodo. */
  lastReviewAt: string | null;
};

export type RestaurantReview = {
  id: string;
  author: string;
  date: Date;
  rating: number;
  text: string;
  sentiment: "positive" | "negative" | "neutral";
  motive?: string;
};

export type ActivityEventType = "alert" | "warning" | "success" | "info";

export type RestaurantActivityEvent = {
  id: string;
  occurredAt: Date;
  description: string;
  type: ActivityEventType;
  reviewId?: string;
};

export type DetectedIssue = {
  id: string;
  label: string;
  intensity: number;
};

export type RestaurantPeriodStats = {
  periodReviews: number;
  periodPositives: number;
  periodNegatives: number;
  periodMedia: number;
  mediaChange: string;
  mediaTrend: "up" | "down" | "flat";
  nps: number;
};

export type RestaurantVolumePoint = {
  label: string;
  positive: number;
  negative: number;
};

export type RestaurantStarBucket = {
  stars: number;
  count: number;
};

export type RestaurantDayBreakdown = {
  dateKey: string;
  label: string;
  positive: number;
  negative: number;
  total: number;
};

export type RestaurantPeriodBreakdown = {
  starDistribution: RestaurantStarBucket[];
  dayBreakdown: RestaurantDayBreakdown[];
  dayBreakdownMode: "week" | "top";
};

export type RestaurantDetail = RestaurantOperational & {
  lastUpdatedAt: Date;
  /** Media pública de Google Maps (null si el scraper aún no la ha cargado). */
  googleMedia: number | null;
  googleReviewsTotal: number | null;
  healthStatus: HealthStatus;
  healthStatusLabel: "Protegido" | "Vigilancia" | "Riesgo";
  primaryAction: string;
  recentActivity: RestaurantActivityEvent[];
  detectedIssues: DetectedIssue[];
  preventHealthStatus: HealthStatus;
  preventHealthLabel: "Protegido" | "Vigilancia" | "Riesgo";
  preventRecommendation: string;
  recentReviews: RestaurantReview[];
  reportHref: string;
  reviewsHref: string;
  alertsHref: string;
  preventHref: string;
  periodStats: RestaurantPeriodStats;
  chartLabels: string[];
  chartValues: number[];
  volumeSeries: RestaurantVolumePoint[];
  periodBreakdown: RestaurantPeriodBreakdown;
};

export type RestaurantsQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};
