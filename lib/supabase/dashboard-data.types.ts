import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { ProblemDistributionItem } from "@/lib/review-metrics";
export type DashboardRankingItem = {
  restaurante: string;
  media_total: number;
  marca: string;
  slug: string;
  brand: BrandId;
  position: number;
};

export type DashboardRiskItem = {
  restaurante: string;
  media_total: number;
  estado: string;
  marca: string;
  slug: string;
  brand: BrandId;
  color: string;
  bg: string;
};

export type DashboardAlertItem = {
  restaurante: string;
  marca: string;
  slug: string;
  brand: BrandId;
  ultima_resena: string | null;
  estrellas: number;
  resenas_negativas: number;
  impacto: number;
  mediaBefore: number | null;
  mediaAfter: number;
  color: string;
  texto?: string;
  reviewId?: string;
  motivoPrincipal?: string;
};

export type DistribucionMarcaItem = {
  marca: string;
  porcentaje: number;
  color: string;
};

export type RestauranteDestacado = {
  restaurante: string;
  media_total: number;
  marca: string;
  resenas_negativas: number;
};

export type DashboardData = {
  mediaGlobal: number;
  totalResenas: number;
  totalPositivas: number;
  totalNegativas: number;
  positivePct: number;
  negativePct: number;
  ultimaActualizacion: string | null;
  totalRestaurantes: number;
  ranking: DashboardRankingItem[];
  restaurantesRiesgo: DashboardRiskItem[];
  alertas: DashboardAlertItem[];
  distribucionMarca: DistribucionMarcaItem[];
  resumenIA: string;
  peorRestaurante: RestauranteDestacado | null;
  restauranteMasNegativas: RestauranteDestacado | null;
  chartPending: boolean;
  chartLabels: string[];
  chartValues: number[];
  chartSource: "kpi_diario" | "resenas" | "empty";
  problemDistribution: ProblemDistributionItem[];
};
