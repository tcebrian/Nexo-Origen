import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import type { OperationalStatus } from "./types";

export const REPUTATION_TARGET = 4.4;

export function mapOperationalStatus(status: string): OperationalStatus {
  const normalized = status.toLowerCase();
  if (normalized.includes("crit") || status === "Crítico") return "critical";
  if (normalized.includes("riesgo") || normalized === "regular" || status === "En riesgo") {
    return "watch";
  }
  return "on_target";
}

export function getStatusLabel(status: OperationalStatus): "En objetivo" | "Vigilancia" | "Riesgo" {
  switch (status) {
    case "critical":
      return "Riesgo";
    case "watch":
      return "Vigilancia";
    default:
      return "En objetivo";
  }
}

export function buildShortRecommendedAction(
  status: OperationalStatus,
  activeAlerts: number,
  recommendedPositiveReviews: number
) {
  if (status === "on_target" && activeAlerts === 0 && recommendedPositiveReviews === 0) {
    return "Mantener el ritmo actual";
  }

  if (recommendedPositiveReviews > 0) {
    return `Conseguir ${recommendedPositiveReviews} reseñas positivas`;
  }

  if (activeAlerts > 0) {
    return `Resolver ${activeAlerts} alerta${activeAlerts === 1 ? "" : "s"} activa${activeAlerts === 1 ? "" : "s"}`;
  }

  return "Monitorizar la evolución semanal";
}

export function getNetworkSummary(
  items: { status: OperationalStatus; currentMedia: number; totalReviews: number }[]
) {
  const total = items.length;
  const onTarget = items.filter((r) => r.status === "on_target").length;
  const onWatch = items.filter((r) => r.status === "watch").length;
  const critical = items.filter((r) => r.status === "critical").length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const periodReviews = items.reduce((sum, r) => sum + r.totalReviews, 0);
  const weightedMediaSum = items.reduce((sum, r) => sum + r.currentMedia * r.totalReviews, 0);
  const networkAverage = periodReviews > 0 ? weightedMediaSum / periodReviews : 0;

  return {
    total,
    onTarget,
    onWatch,
    critical,
    onTargetPct: pct(onTarget),
    onWatchPct: pct(onWatch),
    criticalPct: pct(critical),
    networkAverage,
    targetMedia: REPUTATION_TARGET,
  };
}

export function getProtectionTone(level: number): OperationalStatus {
  if (level >= 75) return "on_target";
  if (level >= 45) return "watch";
  return "critical";
}

export function slugFromName(name: string): string {
  return restaurantSlug(name);
}
