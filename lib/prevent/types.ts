import type { BrandId } from "@/app/dashboard/restaurantes/data";

export const REPUTATION_TARGET = 4.4;

export type PreventStatus = "protegido" | "vigilancia" | "fuera_objetivo";

export type PreventRecord = {
  id: string;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  currentMedia: number;
  reviewCount: number;
  targetMedia: number;
  status: PreventStatus;
  /** Reseñas 5★ necesarias para alcanzar el objetivo. Solo si está fuera. */
  positivesNeeded: number;
  /** Reseñas 1★ absorbibles antes de caer del objetivo. Solo si está en objetivo. */
  negativesTolerance: number;
  /** Protección reputacional 0–99 según margen y volumen. */
  protectionPercent: number;
  action: string;
};

export type PreventNetworkSummary = {
  protectedCount: number;
  watchCount: number;
  outsideGoalCount: number;
  networkProtectionPercent: number;
  totalPositivesNeeded: number;
  totalNegativesBuffer: number;
};

export type PreventWeeklySummary = {
  positivesNeededNetwork: number;
  negativesBufferNetwork: number;
  protectedCount: number;
  atRiskCount: number;
};

export type PreventView = {
  summary: PreventNetworkSummary;
  weekly: PreventWeeklySummary;
  outsideGoal: PreventRecord[];
  watch: PreventRecord[];
  protected: PreventRecord[];
};

export type DateRange = {
  start: Date;
  end: Date;
};
