export type AlertAspectRatio = "4:3" | "9:16";

export type NegativeReviewAlertData = {
  brand_name: string;
  brand_logo_url: string;
  restaurant_name: string;
  /** Ciudad corta para sidebar (ej. Utebo, Zaragoza). */
  restaurant_location: string;
  restaurant_address: string;
  review_author: string;
  review_date: string;
  review_time: string;
  review_stars: number;
  review_comment: string;
  previous_rating: number;
  current_rating: number;
  rating_impact: number;
  risk_level: string;
  source: string;
  detected_reasons: string[];
  sentiment: string;
  recommendation: string;
  nexo_logo_url: string;
  /** Resumen IA desde analisis_ia.resumen. */
  ai_summary?: string | null;
  analisis_pending?: boolean;
  /** Fecha del informe (cabecera). */
  report_date?: string;
  aspect_ratio?: AlertAspectRatio;
  /**
   * Total histórico de reseñas del local (kpi_restaurantes.total_resenas).
   * Necesario para calcular reseñas 5★ reales hacia el objetivo.
   */
  review_count?: number | null;
  /** Media global actual del local (kpi_restaurantes.media_total). */
  lifetime_rating?: number | null;
  /** Objetivo de media (por defecto 4.4). */
  target_rating?: number;
};

export const NEGATIVE_REVIEW_ALERT_FIELDS: (keyof NegativeReviewAlertData)[] = [
  "brand_name",
  "brand_logo_url",
  "restaurant_name",
  "restaurant_location",
  "restaurant_address",
  "review_author",
  "review_date",
  "review_time",
  "review_stars",
  "review_comment",
  "previous_rating",
  "current_rating",
  "rating_impact",
  "risk_level",
  "source",
  "detected_reasons",
  "sentiment",
  "recommendation",
  "nexo_logo_url",
];
