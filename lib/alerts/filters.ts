import { isDateKeyInRange, toDateKey } from "@/lib/dates/period";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { isActionable } from "./status";
import type { AlertFilters, AlertKpis, AlertStatus, RestaurantAlert } from "./types";

const SEVERITY: Record<AlertStatus, number> = {
  critico: 0,
  seguimiento: 1,
  resuelto: 2,
  optimo: 3,
};

export function filterAlertsByPeriod(alerts: RestaurantAlert[], start: Date, end: Date) {
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  return alerts.filter((alert) => isDateKeyInRange(toDateKey(alert.detectedAt), startKey, endKey));
}

export function getAlertMotiveLabel(alert: RestaurantAlert) {
  if (alert.mainMotive && alert.mainMotive !== IA_NO_DATA) {
    return alert.mainMotive;
  }
  return "Reseña negativa";
}

export function filterAlerts(alerts: RestaurantAlert[], filters: AlertFilters) {
  return alerts.filter((alert) => {
    if (filters.brand !== "todas" && alert.brand !== filters.brand) return false;
    if (filters.status !== "todos" && alert.status !== filters.status) return false;
    if (filters.restaurant !== "todos" && alert.restaurantSlug !== filters.restaurant) return false;
    return true;
  });
}

export function sortAlertsBySeverity(alerts: RestaurantAlert[]) {
  return [...alerts].sort((a, b) => {
    const severity = SEVERITY[a.status] - SEVERITY[b.status];
    if (severity !== 0) return severity;
    return b.activeAlerts - a.activeAlerts;
  });
}

export function getUrgentAlerts(alerts: RestaurantAlert[]) {
  return sortAlertsBySeverity(alerts).filter(
    (a) => a.status === "critico" || a.status === "seguimiento"
  );
}

export function getRiskRadarAlerts(alerts: RestaurantAlert[]) {
  return sortAlertsBySeverity(alerts);
}

export function getAlertKpis(alerts: RestaurantAlert[], resolvedThisWeek: number): AlertKpis {
  const openAlerts = alerts.filter((alert) => isActionable(alert));
  const restaurantsAffected = new Set(openAlerts.map((alert) => alert.restaurantSlug)).size;

  return {
    open: openAlerts.length,
    critical: alerts.filter((alert) => alert.status === "critico").length,
    followUp: alerts.filter((alert) => alert.status === "seguimiento").length,
    resolvedThisWeek,
    restaurantsAffected,
    iaPending: alerts.filter((alert) => alert.iaPending).length,
  };
}

export function getTopPriorityAlert(alerts: RestaurantAlert[]) {
  return getUrgentAlerts(alerts)[0] ?? null;
}

export type RestaurantHotspot = {
  slug: string;
  name: string;
  brand: RestaurantAlert["brand"];
  critical: number;
  total: number;
};

export function getRestaurantHotspots(alerts: RestaurantAlert[], limit = 4): RestaurantHotspot[] {
  const counts = new Map<string, RestaurantHotspot>();

  for (const alert of getUrgentAlerts(alerts)) {
    const current = counts.get(alert.restaurantSlug) ?? {
      slug: alert.restaurantSlug,
      name: alert.restaurant,
      brand: alert.brand,
      critical: 0,
      total: 0,
    };
    current.total += 1;
    if (alert.status === "critico") current.critical += 1;
    counts.set(alert.restaurantSlug, current);
  }

  return Array.from(counts.values())
    .sort((a, b) => b.critical - a.critical || b.total - a.total || a.name.localeCompare(b.name, "es"))
    .slice(0, limit);
}

export function getBrandOptions(alerts: RestaurantAlert[]) {
  const brands = new Map<string, string>();
  for (const alert of alerts) {
    brands.set(alert.brand, alert.brand);
  }
  return Array.from(brands.keys());
}

export function getRestaurantOptions(alerts: RestaurantAlert[]) {
  const restaurants = new Map<string, string>();
  for (const alert of alerts) {
    restaurants.set(alert.restaurantSlug, alert.restaurant);
  }
  return Array.from(restaurants.entries())
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
