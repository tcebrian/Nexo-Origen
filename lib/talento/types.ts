import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type MentionSentiment = "positive" | "negative" | "neutral";

/** Mención individual detectada en una reseña — base para análisis IA. */
export type EmployeeMention = {
  reviewId: string;
  restaurant: string;
  restaurantSlug: string;
  sentiment: MentionSentiment;
  motive?: string;
  excerpt: string;
  date: Date;
};

/** Empleado agregado a partir de menciones en reseñas. */
export type EmployeeRecord = {
  id: string;
  name: string;
  role?: string;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  totalMentions: number;
  positiveMentions: number;
  negativeMentions: number;
  neutralMentions: number;
  positivePercent: number;
  negativeMotives: { name: string; count: number }[];
  featuredComment?: string;
  /** Crecimiento de menciones vs periodo anterior (%). */
  mentionGrowth: number;
  /** Mejora en % positivas vs periodo anterior (puntos). */
  sentimentImprovement: number;
  mentions: EmployeeMention[];
};

export type TalentoSummary = {
  employeesMentioned: number;
  positiveMentions: number;
  negativeMentions: number;
  topMentionedEmployee: { name: string; mentions: number; id: string } | null;
};

export type TalentoSummaryTrends = {
  employeesMentionedDelta: number;
  positiveMentionsDelta: number;
  negativeMentionsDelta: number;
};

export type TalentoFeaturedComment = {
  id: string;
  employeeId: string;
  employeeName: string;
  excerpt: string;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  stars: number;
  reviewId: string;
  date: Date;
};

export type TalentoRestaurantRow = {
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  employeesMentioned: number;
  positiveMentions: number;
  negativeMentions: number;
  topEmployee: { id: string; name: string; mentions: number } | null;
};

export type TalentoTrendItem = {
  employee: EmployeeRecord;
  label: string;
  value: string;
  direction: "up" | "down" | "flat";
  sparkline: number[];
};

export type TalentoView = {
  summary: TalentoSummary;
  summaryTrends: TalentoSummaryTrends;
  featuredEmployees: EmployeeRecord[];
  featuredComments: TalentoFeaturedComment[];
  restaurantRows: TalentoRestaurantRow[];
  trendItems: TalentoTrendItem[];
  improvementOpportunities: EmployeeRecord[];
  /** @deprecated Usar featuredEmployees */
  featured: EmployeeRecord | null;
  mostMentioned: EmployeeRecord[];
  improving: EmployeeRecord[];
  growing: EmployeeRecord[];
};

export type TalentoPayload = {
  employees: EmployeeRecord[];
  summaryTrends: TalentoSummaryTrends;
};

export type DateRange = {
  start: Date;
  end: Date;
};
