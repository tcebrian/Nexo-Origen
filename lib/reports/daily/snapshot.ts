import type { DailyReportKind, DailySlot } from "./calendar";

/**
 * FOTO del informe diario, calculada en el slot de las 09:00 y guardada en `conv_informe_envios.snapshot`.
 * "Ver informe" se renderiza desde aquí, sin volver a consultar reseñas: nuevas reseñas, ediciones o
 * cambios posteriores no alteran un informe ya enviado.
 *
 * Cada restaurante guarda sus cifras BRUTAS (reseñas, suma de estrellas, positivas, neutras, negativas):
 * los totales y las medias se derivan de ellas al renderizar, así que si luego hubiera que ocultar un
 * restaurante (permiso retirado) los totales siguen siendo coherentes sin recalcular nada desde la base.
 */

export const SNAPSHOT_VERSION = 1;

/** Objetivo de reputación de Nexo: media ≥ 4,4 (BUSINESS_RULES). */
export const TARGET_AVERAGE = 4.4;
/** Por debajo de objetivo − 0,4 (4,0) el restaurante pasa de amarillo a rojo. */
export const WATCH_MARGIN = 0.4;

export type SnapshotRestaurant = {
  id: number;
  name: string;
  brand: string;
  reviews: number;
  ratingSum: number;
  positive: number;
  neutral: number;
  negative: number;
  /** Motivo más frecuente de sus reseñas negativas, si existe. */
  topReason: string | null;
};

export type DailyReportSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  kind: DailyReportKind;
  slotDate: string;
  /** Momento del slot (hora de pared de Madrid): para WEEK_TO_DATE, el fin de la ventana. */
  slotAt: string;
  period: {
    start: string;
    end: string;
    firstDay: string;
    lastDay: string;
  };
  restaurants: SnapshotRestaurant[];
};

export type RestaurantInfo = { id: number; name: string; brand: string };
export type WindowMetrics = { reviews: number; ratingSum: number; positive: number; neutral: number; negative: number };

export function buildSnapshot(input: {
  slot: DailySlot;
  restaurants: RestaurantInfo[];
  metrics: Map<number, WindowMetrics>;
  reasons: Map<number, string | null>;
}): DailyReportSnapshot {
  const { slot } = input;
  const restaurants = input.restaurants
    .map((restaurant): SnapshotRestaurant => {
      const metrics = input.metrics.get(restaurant.id);
      return {
        id: restaurant.id,
        name: restaurant.name,
        brand: restaurant.brand,
        reviews: metrics?.reviews ?? 0,
        ratingSum: metrics?.ratingSum ?? 0,
        positive: metrics?.positive ?? 0,
        neutral: metrics?.neutral ?? 0,
        negative: metrics?.negative ?? 0,
        topReason: input.reasons.get(restaurant.id) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es") || a.id - b.id);

  return {
    version: SNAPSHOT_VERSION,
    kind: slot.kind,
    slotDate: slot.slotDate,
    slotAt: slot.kind === "WEEK_TO_DATE" ? slot.periodEnd : `${slot.slotDate}T09:00:00`,
    period: { start: slot.periodStart, end: slot.periodEnd, firstDay: slot.firstDay, lastDay: slot.lastDay },
    restaurants,
  };
}

export type RestaurantStatus = "green" | "yellow" | "red" | "none";

/** Estado determinista de un restaurante: ≥ 4,4 verde · ≥ 4,0 amarillo · menos, rojo · sin reseñas, sin estado. */
export function restaurantStatus(restaurant: Pick<SnapshotRestaurant, "reviews" | "ratingSum">): RestaurantStatus {
  if (restaurant.reviews === 0) return "none";
  const average = restaurant.ratingSum / restaurant.reviews;
  if (average >= TARGET_AVERAGE) return "green";
  if (average >= TARGET_AVERAGE - WATCH_MARGIN) return "yellow";
  return "red";
}

/** Valida lo mínimo de un snapshot leído de la base de datos antes de renderizarlo. */
export function isDailyReportSnapshot(value: unknown): value is DailyReportSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<DailyReportSnapshot>;
  return (
    snapshot.version === SNAPSHOT_VERSION &&
    (snapshot.kind === "WEEKLY_CLOSURE" || snapshot.kind === "WEEK_TO_DATE") &&
    typeof snapshot.slotDate === "string" &&
    typeof snapshot.period === "object" &&
    snapshot.period !== null &&
    Array.isArray(snapshot.restaurants) &&
    snapshot.restaurants.every(
      (restaurant) =>
        typeof restaurant === "object" &&
        restaurant !== null &&
        typeof restaurant.id === "number" &&
        typeof restaurant.name === "string" &&
        typeof restaurant.reviews === "number" &&
        typeof restaurant.ratingSum === "number"
    )
  );
}
