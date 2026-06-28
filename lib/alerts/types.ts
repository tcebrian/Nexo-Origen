import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type AlertStatus = "critico" | "seguimiento" | "resuelto" | "optimo";

export type AlertMotive = {
  name: string;
  percentage: number;
};

export type RestaurantAlert = {
  id: string;
  restaurant: string;
  restaurantSlug: string;
  brand: BrandId;
  status: AlertStatus;
  activeAlerts: number;
  mediaBefore: number | null;
  mediaAfter: number;
  mainMotive: string;
  detectedAt: Date;
  resolvedAt?: Date;
  affectedReviews: number;
  whatHappened: string;
  estimatedImpact: string;
  motives: AlertMotive[];
  recommendation: string;
  iaPending?: boolean;
};

export type AlertKpis = {
  open: number;
  critical: number;
  followUp: number;
  resolvedThisWeek: number;
  restaurantsAffected: number;
  iaPending: number;
};

export type AlertExecutiveStats = AlertKpis;

export type AlertFilters = {
  brand: "todas" | BrandId;
  status: "todos" | AlertStatus;
  restaurant: string;
};

export type DateRange = {
  start: Date;
  end: Date;
};
