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
