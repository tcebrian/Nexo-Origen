import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type NegativeReviewReportRow = {
  id: string;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  brandLabel: string;
  /** Ciudad corta para cabecera del informe (ej. UTEBO, TUDELA). */
  city: string;
  address: string;
  author: string;
  dateIso: string;
  dateLabel: string;
  stars: number;
  comment: string;
  motive: string;
  detectedReasons: string[];
  sentiment: string;
  riskLevel: string;
  aiSummary: string | null;
  analisisPending: boolean;
  mediaBefore: number | null;
  mediaAfter: number | null;
  impact: number | null;
  impactText: string;
  recommendation: string;
  /** Reseñas del periodo incluyendo la actual (solo impacto en media del rango). */
  reviewCountAfter: number | null;
  /** Total histórico de reseñas del local (kpi_restaurantes.total_resenas). */
  totalReviews: number | null;
  /** Media global actual del local (kpi_restaurantes.media_total). */
  lifetimeMedia: number | null;
};

export type NegativeReviewsQuery = {
  start: Date;
  end: Date;
  /** Marcas habilitadas para informes visuales (fase 1: solo BK). */
  brands?: BrandId[];
  limit?: number;
};
