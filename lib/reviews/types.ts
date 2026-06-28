import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type ReviewSentiment = "positiva" | "negativa" | "neutral";
export type ReviewPriority = "Alta" | "Media" | "Baja";
export type ReviewSource = "google";
export type ReviewSort = "recent" | "rating-desc" | "rating-asc" | "priority";

export type ReviewCategory =
  | "atencion"
  | "tiempo_espera"
  | "calidad_producto"
  | "limpieza"
  | "error_pedido"
  | "falta_producto"
  | "otros";

export const REVIEW_CATEGORY_LABELS: Record<ReviewCategory, string> = {
  atencion: "Atención",
  tiempo_espera: "Tiempo de espera",
  calidad_producto: "Calidad producto",
  limpieza: "Limpieza",
  error_pedido: "Error de pedido",
  falta_producto: "Falta de producto",
  otros: "Otros",
};

export type ReviewAiAnalysis = {
  summary: string;
  motives: string[];
  emotions: string[];
  previousMedia: number;
  currentMedia: number;
  impact: number;
  impactLabel: string;
  priority: ReviewPriority;
  recommendedAction: string;
  suggestedReply: string;
  confidence: number | null;
  risk: string;
  sentiment: string;
  employeeMentioned: string | null;
  pending: boolean;
};

export type Review = {
  id: string;
  /** review_id de Google / Supabase — clave de analisis_ia.review_id */
  reviewId: string | null;
  /** id numérico interno de la tabla resenas (solo referencia). */
  resenaId: string;
  author: string;
  initials: string;
  rating: number;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  brandLabel: string;
  text: string;
  date: Date;
  location?: string;
  source: ReviewSource;
  sentiment: ReviewSentiment;
  category: ReviewCategory;
  priority: ReviewPriority;
  estimatedImpact: string;
  mediaBefore: number | null;
  mediaAfter: number | null;
  mediaImpact: number | null;
  /** Etiqueta de sentimiento desde analisis_ia (o Sin datos IA). */
  sentimentLabel: string;
  /** Motivo principal desde analisis_ia (o Sin datos IA). */
  motiveLabel: string;
  /** Riesgo desde analisis_ia (o Sin datos IA). */
  riskLevel: string;
  /** Impacto narrativo desde analisis_ia (o Sin datos IA). */
  impactLabel: string;
  employeeMentioned: string | null;
  iaPending: boolean;
  recommendedAction: string;
  reviewed: boolean;
  analyzed: boolean;
  ai?: ReviewAiAnalysis;
};

export type ReviewFilters = {
  brand: "todas" | BrandId;
  restaurant: string;
  stars: string;
  negativesOnly: boolean;
  unreviewedOnly: boolean;
  query: string;
};

export type ReviewStats = {
  total: number;
  positives: number;
  negatives: number;
  unreviewed: number;
  avg: string;
  positivePct: number;
  negativePct: number;
  changePct: number;
};

export type DateRange = {
  start: Date;
  end: Date;
};
