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
  /** Nombre completo del restaurante tal cual está en Supabase (`name` es la versión corta, sin la marca). */
  fullName: string;
  /** Marca normalizada (BrandId) para buscar su logotipo. */
  brandId: string;
  /** Reseñas de 4-5 estrellas del periodo. */
  positiveReviews: number;
  /** Reseñas de 1-2 estrellas del periodo. */
  negativeReviews: number;
  /** Motivo real más frecuente entre sus reseñas negativas, o null si no hay negativas con motivo. */
  topNegativeMotive: string | null;
};

export type NetworkSummaryReasonSegment = {
  label: string;
  /** Categoría SNAKE_CASE original de resena_motivos (p.ej. "TIEMPO_ESPERA") — para buscarle un emoji de referencia. */
  categoria: string;
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
  /** Ciudades únicas del grupo, en mayúsculas y unidas por " + " (p.ej. "MADRID + LOGROÑO"). */
  citiesLabel: string;
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
  /** Nº real de reseñas negativas con categoría en resena_motivos (suma de negativeReasons). */
  negativeReasonsTotal: number;
};

/**
 * Respuesta cruda de public.nexo_network_summary_payload (Supabase). Ya viene
 * calculada; ver supabase/network_summary_payload.sql para las reglas.
 */
export type NetworkSummaryPayload = {
  period: { start: string; end: string };
  /** Objetivo de media de la marca (marcas.objetivo_media; el mayor si el grupo mezcla objetivos). */
  target_average: number;
  watch_threshold: number;
  negative_max_stars: number;
  totals: {
    locations: number;
    reviews: number;
    positive: number;
    neutral: number;
    negative: number;
    positive_pct: number;
    negative_pct: number;
    weighted_average: number;
    below_target_count: number;
  };
  /** Nombres completos, de peor a mejor media. */
  below_target_locations: string[];
  cities_label: string;
  locations: {
    restaurante_id: number;
    restaurante: string;
    ciudad: string;
    marca: string;
    target: number;
    rating: number | null;
    reviews: number;
    positive: number;
    neutral: number;
    negative: number;
    status: NetworkSummaryLocationStatus;
    top_negative_categoria: string | null;
  }[];
  negative_reasons: { categoria: string; count: number; percent: number }[];
  negative_reasons_total: number;
};
