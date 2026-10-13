import { comparisonWindowEnd, type DailyReportKind, type DailySlot } from "./calendar";

/**
 * FOTO del informe diario, calculada en el slot de las 09:00 y guardada en `conv_informe_envios.snapshot`.
 * "Ver informe" se renderiza desde aquí, sin volver a consultar reseñas: nuevas reseñas, ediciones o
 * cambios posteriores no alteran un informe ya enviado.
 *
 * Cada restaurante guarda sus cifras BRUTAS (reseñas, suma de estrellas, positivas, neutras, negativas):
 * los totales, las medias y las métricas por marca se derivan de ellas al renderizar (`briefing.ts`), así
 * que si luego hubiera que ocultar un restaurante (permiso retirado) los totales siguen siendo coherentes
 * sin recalcular nada desde la base.
 *
 * Versión 2 (briefing operativo) añade, por restaurante: empresa, objetivo de su marca, las cifras de la
 * ventana de comparación (`previous`) y las negativas nuevas desde el corte anterior. Los snapshots de
 * versión 1 siguen siendo válidos: sin esos campos se renderizan sin comparación y con objetivo 4,4.
 */

export const SNAPSHOT_VERSION = 2;

/** Objetivo de reputación de Nexo por defecto: media ≥ 4,4 (BUSINESS_RULES). */
export const TARGET_AVERAGE = 4.4;
/** Por debajo de esta media (fija, igual para todas las marcas) el restaurante es crítico (rojo). */
export const CRITICAL_AVERAGE = 4.0;

export type WindowMetrics = { reviews: number; ratingSum: number; positive: number; neutral: number; negative: number };

/** Negativa nueva desde el corte anterior: solo lo necesario para el informe, nunca autor ni texto largo. */
export type NewNegative = {
  stars: number;
  /** Hora de pared de Madrid (`YYYY-MM-DDTHH:MM:SS`) de la actividad de la reseña. */
  at: string;
  /** Motivo principal (categoría guardada o clasificador); `null` si no es causal. */
  reason: string | null;
  /** Resumen del análisis ya guardado o, si no hay, el comienzo del comentario (≤ 110 caracteres). */
  excerpt: string | null;
};

/** Negativas nuevas que se conservan por restaurante; el total real queda en `newNegativeCount`. */
export const MAX_STORED_NEW_NEGATIVES = 5;

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
  // v2 ----------------------------------------------------------------------------------------------
  /** Nombre de la empresa propietaria (de los datos reales). */
  company?: string | null;
  /** Objetivo de media de su marca (`marcas.objetivo_media`). */
  target?: number;
  /** Cifras de la ventana de comparación (ayer o domingo); `null` si no hay comparación. */
  previous?: WindowMetrics | null;
  newNegatives?: NewNegative[];
  newNegativeCount?: number;
};

export type SnapshotComparison = {
  /** "DAY_BEFORE": mismo corte del día anterior · "SUNDAY": cierre semanal frente al domingo 09:00. */
  reference: "DAY_BEFORE" | "SUNDAY";
  /** Fin (excl.) de la ventana de comparación, hora de pared de Madrid. */
  previousPeriodEnd: string;
};

export type DailyReportSnapshot = {
  version: 1 | typeof SNAPSHOT_VERSION;
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
  /** Cómo se obtuvieron los `previous` de cada restaurante (v2). */
  comparison?: SnapshotComparison | null;
};

export type RestaurantInfo = {
  id: number;
  name: string;
  brand: string;
  company?: string | null;
  /** `marcas.objetivo_media`; si falta, 4,4. */
  target?: number;
};

export function buildSnapshot(input: {
  slot: DailySlot;
  restaurants: RestaurantInfo[];
  metrics: Map<number, WindowMetrics>;
  reasons: Map<number, string | null>;
  /** Cifras de la ventana de comparación por restaurante. Ausente → sin comparación. */
  previousMetrics?: Map<number, WindowMetrics>;
  /** Negativas nuevas desde el corte anterior, por restaurante (todas; aquí se acota lo que se guarda). */
  newNegatives?: Map<number, NewNegative[]>;
}): DailyReportSnapshot {
  const { slot } = input;
  const hasComparison = input.previousMetrics !== undefined;
  const empty: WindowMetrics = { reviews: 0, ratingSum: 0, positive: 0, neutral: 0, negative: 0 };

  const restaurants = input.restaurants
    .map((restaurant): SnapshotRestaurant => {
      const metrics = input.metrics.get(restaurant.id);
      const news = (input.newNegatives?.get(restaurant.id) ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
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
        company: restaurant.company ?? null,
        target: restaurant.target ?? TARGET_AVERAGE,
        previous: hasComparison ? { ...(input.previousMetrics!.get(restaurant.id) ?? empty) } : null,
        newNegatives: news.slice(0, MAX_STORED_NEW_NEGATIVES),
        newNegativeCount: news.length,
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
    comparison: hasComparison
      ? { reference: slot.kind === "WEEKLY_CLOSURE" ? "SUNDAY" : "DAY_BEFORE", previousPeriodEnd: comparisonWindowEnd(slot) }
      : null,
  };
}

export type RestaurantStatus = "green" | "yellow" | "red" | "none";

/**
 * Estado determinista, con el objetivo de la MARCA del restaurante:
 *   media ≥ objetivo → verde (en objetivo) · media ≥ 4,00 y < objetivo → amarillo (en vigilancia) ·
 *   media < 4,00 → rojo (crítico) · sin reseñas → sin estado.
 * "En objetivo / fuera de objetivo" usa exactamente esta misma regla. Se compara la media real (sin
 * redondear): 4,395 no es 4,4.
 */
export function restaurantStatus(
  restaurant: Pick<SnapshotRestaurant, "reviews" | "ratingSum">,
  target: number = TARGET_AVERAGE
): RestaurantStatus {
  if (restaurant.reviews === 0) return "none";
  const average = restaurant.ratingSum / restaurant.reviews;
  if (average >= target) return "green";
  if (average >= CRITICAL_AVERAGE) return "yellow";
  return "red";
}

/**
 * Menor número entero n ≥ 0 de reseñas de 5★ nuevas para que (sumStars + 5n) / (reviews + n) ≥ objetivo.
 * `0` si ya está en objetivo; `null` si el objetivo es ≥ 5 (inalcanzable) o no hay datos válidos.
 */
export function positivesNeeded(reviews: number, ratingSum: number, target: number): number | null {
  if (!Number.isFinite(reviews) || !Number.isFinite(ratingSum) || reviews < 0 || !Number.isFinite(target)) return null;
  if (reviews > 0 && ratingSum / reviews >= target) return 0;
  if (target >= 5) return null;
  if (reviews === 0) return null;

  // (S + 5n) ≥ T(R + n)  ⇒  n ≥ (T·R − S) / (5 − T)
  let n = Math.max(0, Math.ceil((target * reviews - ratingSum) / (5 - target) - 1e-9));
  // Ajuste exacto frente a errores de coma flotante.
  while (n > 0 && (ratingSum + 5 * (n - 1)) / (reviews + n - 1) >= target) n -= 1;
  while ((ratingSum + 5 * n) / (reviews + n) < target) n += 1;
  return n;
}

/** Valida lo mínimo de un snapshot leído de la base de datos antes de renderizarlo (acepta v1 y v2). */
export function isDailyReportSnapshot(value: unknown): value is DailyReportSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<DailyReportSnapshot>;
  return (
    (snapshot.version === 1 || snapshot.version === 2) &&
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
