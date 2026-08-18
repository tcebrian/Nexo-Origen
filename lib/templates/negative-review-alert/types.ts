export type AlertAspectRatio = "4:3" | "9:16";

export type NegativeReviewAlertData = {
  /** Código de marca (ej. "bk") — decide qué plantilla visual se usa. Opcional: si falta, se usa la genérica. */
  brand?: string;
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
  /** analisis_ia.motivo — motivo principal detectado por la IA (texto libre, no la lista de chips). */
  main_motive?: string | null;
  /** analisis_ia.impacto — descripción textual del impacto (distinta del delta numérico). */
  detected_impact?: string | null;
  /** analisis_ia.empleado_mencionado. */
  employee_mentioned?: string | null;
  /** Periodo del informe desde el que se generó esta alerta (para el bloque de contexto). */
  period_label?: string | null;
  /** Contexto semanal (semana natural lunes–domingo de la reseña vs. la semana anterior). */
  weekly_period_label?: string | null;
  weekly_reviews_before?: number | null;
  weekly_reviews_after?: number | null;
  weekly_media_before?: number | null;
  weekly_media_after?: number | null;
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
