import {
  positivesNeeded,
  restaurantStatus,
  TARGET_AVERAGE,
  type DailyReportSnapshot,
  type NewNegative,
  type RestaurantStatus,
  type SnapshotRestaurant,
  type WindowMetrics,
} from "./snapshot";

/**
 * Modelo derivado del briefing operativo. Función pura del snapshot (y de los permisos vigentes):
 * agrupa por marca, estados, prioridades y hechos relevantes. No consulta nada y no calcula reseñas.
 */

/** Volumen bajo: de 1 a 6 reseñas la media no es concluyente. */
export const LOW_VOLUME_MAX = 6;
/** Prioridades que se muestran como máximo; el resto se indica explícitamente. */
export const MAX_PRIORITIES = 8;
/** Negativas nuevas que se detallan por restaurante en prioridades. */
export const MAX_NEW_NEGATIVES_SHOWN = 2;
/** Una marca no preferente con menos locales que esto se agrupa en "RESTO". */
export const RESTO_MIN_LOCALS = 3;

/** Marcas con bloque propio y orden preferente (clave normalizada). */
const PREFERRED_BRANDS = ["burger king", "popeyes", "santa gloria", "tim hortons"] as const;
const BRAND_ICONS: Record<string, string> = {
  "burger king": "🍔",
  popeyes: "🍗",
  "santa gloria": "🥐",
  "tim hortons": "☕",
};
/** Abreviaturas de uso interno del equipo (solo cuando existen). */
const BRAND_SHORT: Record<string, string> = { "burger king": "BK" };

export const normalizeBrand = (brand: string): string =>
  brand.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");

/** Quita caracteres que WhatsApp interpretaría como formato dentro de datos dinámicos. */
export function plainText(value: string): string {
  return value.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
}

export type DerivedRestaurant = {
  id: number;
  name: string;
  /** Nombre para mostrar (marca abreviada cuando existe, p. ej. "BK Soria"). */
  displayName: string;
  brand: string;
  reviews: number;
  ratingSum: number;
  positive: number;
  neutral: number;
  negative: number;
  average: number | null;
  target: number;
  status: RestaurantStatus;
  lowVolume: boolean;
  /** Reseñas de 5★ necesarias para llegar al objetivo; `null` si ya cumple o no aplica. */
  positivesNeeded: number | null;
  previous: WindowMetrics | null;
  previousAverage: number | null;
  /** La media ha bajado respecto a la comparación. */
  deteriorated: boolean;
  newNegatives: NewNegative[];
  newNegativeCount: number;
  topReason: string | null;
};

export type Totals = { reviews: number; ratingSum: number; positive: number; neutral: number; negative: number };

export type BrandBlock = {
  key: string;
  /** Nombre del bloque ("BURGER KING", "RESTO"). */
  label: string;
  /** Nombre corto para "Lectura BK:". */
  short: string;
  icon: string;
  isResto: boolean;
  restaurants: DerivedRestaurant[];
  /** Fuera de objetivo: rojos primero, amarillos después, peor media primero. */
  off: DerivedRestaurant[];
  /** En objetivo, mejor media primero. */
  on: DerivedRestaurant[];
  /** Sin actividad (0 reseñas). */
  inactive: DerivedRestaurant[];
  totals: Totals;
  average: number | null;
  /** Objetivo de la marca (el de sus restaurantes; en RESTO, `null` si mezcla). */
  target: number | null;
  previousTotals: Totals | null;
  previousAverage: number | null;
  newNegativeCount: number;
};

export type Briefing = {
  restaurants: DerivedRestaurant[];
  totals: Totals;
  average: number | null;
  /** Objetivo común o, si varía, el más frecuente. */
  defaultTarget: number;
  /** Objetivo de cada marca visible, en orden de marca (leyenda). */
  brandTargets: { brand: string; target: number }[];
  /** Objetivo común si todos los restaurantes visibles comparten el mismo; `null` si hay objetivos distintos. */
  uniformTarget: number | null;
  counts: { onTarget: number; offTarget: number; inactive: number };
  /** `null` si el snapshot no trae comparación. */
  comparison: {
    reference: "DAY_BEFORE" | "SUNDAY";
    previousTotals: Totals;
    previousAverage: number | null;
    previousActive: number;
  } | null;
  newNegativeCount: number;
  priorities: DerivedRestaurant[];
  /** Prioridades que no caben en el máximo mostrado. */
  prioritiesOmitted: number;
  brands: BrandBlock[];
  /** Restaurantes retirados por permisos (no se muestran). */
  hidden: number;
  companies: string[];
};

const sum = (items: Totals[]): Totals =>
  items.reduce(
    (acc, item) => ({
      reviews: acc.reviews + item.reviews,
      ratingSum: acc.ratingSum + item.ratingSum,
      positive: acc.positive + item.positive,
      neutral: acc.neutral + item.neutral,
      negative: acc.negative + item.negative,
    }),
    { reviews: 0, ratingSum: 0, positive: 0, neutral: 0, negative: 0 }
  );

const averageOf = (totals: { reviews: number; ratingSum: number }): number | null =>
  totals.reviews > 0 ? totals.ratingSum / totals.reviews : null;

function displayNameOf(name: string, brand: string): string {
  const short = BRAND_SHORT[normalizeBrand(brand)];
  const trimmed = brand.trim();
  if (short && trimmed && name.toLowerCase().startsWith(trimmed.toLowerCase())) {
    // El nombre puede venir ya con la abreviatura ("Burger King BK Soria"): no se repite ("BK BK Soria").
    const rest = name
      .slice(trimmed.length)
      .trim()
      .replace(new RegExp(`^${short}(?=\\s|$)\\s*`, "i"), "");
    return plainText(`${short}${rest ? ` ${rest}` : ""}`);
  }
  return plainText(name);
}

function derive(restaurant: SnapshotRestaurant): DerivedRestaurant {
  const target = restaurant.target ?? TARGET_AVERAGE;
  const average = averageOf(restaurant);
  const status = restaurantStatus(restaurant, target);
  const previous = restaurant.previous ?? null;
  const previousAverage = previous ? averageOf(previous) : null;
  const newNegatives = restaurant.newNegatives ?? [];

  return {
    id: restaurant.id,
    name: restaurant.name,
    displayName: displayNameOf(restaurant.name, restaurant.brand),
    brand: restaurant.brand,
    reviews: restaurant.reviews,
    ratingSum: restaurant.ratingSum,
    positive: restaurant.positive,
    neutral: restaurant.neutral,
    negative: restaurant.negative,
    average,
    target,
    status,
    lowVolume: restaurant.reviews >= 1 && restaurant.reviews <= LOW_VOLUME_MAX,
    positivesNeeded:
      status === "red" || status === "yellow" ? positivesNeeded(restaurant.reviews, restaurant.ratingSum, target) : null,
    previous,
    previousAverage,
    deteriorated: average !== null && previousAverage !== null && average < previousAverage - 1e-9,
    newNegatives,
    newNegativeCount: restaurant.newNegativeCount ?? newNegatives.length,
    topReason: restaurant.topReason ?? null,
  };
}

const byName = (a: DerivedRestaurant, b: DerivedRestaurant) => a.displayName.localeCompare(b.displayName, "es") || a.id - b.id;
const statusRank = (status: RestaurantStatus) => (status === "red" ? 0 : status === "yellow" ? 1 : 2);

/** Fuera de objetivo: rojos primero, amarillos después, peor media primero en cada grupo. */
function sortOff(list: DerivedRestaurant[]): DerivedRestaurant[] {
  return [...list].sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.average! - b.average! || byName(a, b));
}
function sortOn(list: DerivedRestaurant[]): DerivedRestaurant[] {
  return [...list].sort((a, b) => b.average! - a.average! || b.reviews - a.reviews || byName(a, b));
}

function buildBrandBlock(key: string, label: string, short: string, icon: string, isResto: boolean, list: DerivedRestaurant[]): BrandBlock {
  const totals = sum(list);
  const previousList = list.map((restaurant) => restaurant.previous);
  const hasPrevious = previousList.length > 0 && previousList.every((previous) => previous !== null);
  const previousTotals = hasPrevious ? sum(previousList as Totals[]) : null;
  const targets = [...new Set(list.map((restaurant) => restaurant.target))];

  return {
    key,
    label,
    short,
    icon,
    isResto,
    restaurants: list,
    off: sortOff(list.filter((restaurant) => restaurant.status === "red" || restaurant.status === "yellow")),
    on: sortOn(list.filter((restaurant) => restaurant.status === "green")),
    inactive: list.filter((restaurant) => restaurant.status === "none").sort(byName),
    totals,
    average: averageOf(totals),
    target: targets.length === 1 ? targets[0]! : null,
    previousTotals,
    previousAverage: previousTotals ? averageOf(previousTotals) : null,
    newNegativeCount: list.reduce((acc, restaurant) => acc + restaurant.newNegativeCount, 0),
  };
}

function groupBrands(restaurants: DerivedRestaurant[]): BrandBlock[] {
  const byBrand = new Map<string, DerivedRestaurant[]>();
  for (const restaurant of restaurants) {
    const key = normalizeBrand(restaurant.brand) || "(sin marca)";
    byBrand.set(key, [...(byBrand.get(key) ?? []), restaurant]);
  }

  const blocks: BrandBlock[] = [];
  const resto: DerivedRestaurant[] = [];
  const others: [string, DerivedRestaurant[]][] = [];

  for (const [key, list] of byBrand) {
    const preferred = (PREFERRED_BRANDS as readonly string[]).includes(key);
    if (preferred) {
      const name = plainText(list[0]!.brand);
      blocks.push(buildBrandBlock(key, name.toUpperCase(), BRAND_SHORT[key] ?? name, BRAND_ICONS[key] ?? "🏪", false, list));
    } else if (list.length >= RESTO_MIN_LOCALS && key !== "(sin marca)") {
      others.push([key, list]);
    } else {
      resto.push(...list);
    }
  }

  blocks.sort(
    (a, b) =>
      (PREFERRED_BRANDS as readonly string[]).indexOf(a.key) - (PREFERRED_BRANDS as readonly string[]).indexOf(b.key)
  );
  others.sort((a, b) => a[0].localeCompare(b[0], "es"));
  for (const [key, list] of others) {
    const name = plainText(list[0]!.brand);
    blocks.push(buildBrandBlock(key, name.toUpperCase(), BRAND_SHORT[key] ?? name, "🏪", false, list));
  }
  if (resto.length > 0) blocks.push(buildBrandBlock("(resto)", "RESTO", "resto", "📍", true, resto));
  return blocks;
}

/** Prioridades: fuera de objetivo con negativas → peor media → mayor volumen → deterioro → nuevas negativas. */
function pickPriorities(restaurants: DerivedRestaurant[]): DerivedRestaurant[] {
  const offWithNegatives = (r: DerivedRestaurant) => (r.status === "red" || r.status === "yellow") && r.negative > 0;
  const candidates = restaurants.filter(
    (r) => r.status === "red" || (r.status === "yellow" && r.negative > 0) || r.newNegativeCount > 0
  );

  return candidates.sort((a, b) => {
    const group = Number(offWithNegatives(b)) - Number(offWithNegatives(a));
    if (group !== 0) return group;
    const avgA = a.average ?? Infinity;
    const avgB = b.average ?? Infinity;
    if (avgA !== avgB) return avgA - avgB;
    if (b.reviews !== a.reviews) return b.reviews - a.reviews;
    const dropA = a.previousAverage !== null && a.average !== null ? a.previousAverage - a.average : 0;
    const dropB = b.previousAverage !== null && b.average !== null ? b.previousAverage - b.average : 0;
    if (dropB !== dropA) return dropB - dropA;
    if (b.newNegativeCount !== a.newNegativeCount) return b.newNegativeCount - a.newNegativeCount;
    return byName(a, b);
  });
}

export function buildBriefing(snapshot: DailyReportSnapshot, options: { allowedRestaurantIds?: ReadonlySet<number> } = {}): Briefing {
  const allowed = options.allowedRestaurantIds;
  const visible = allowed ? snapshot.restaurants.filter((restaurant) => allowed.has(restaurant.id)) : snapshot.restaurants;
  const restaurants = visible.map(derive);

  const totals = sum(restaurants);
  const withPrevious = restaurants.length > 0 && restaurants.every((restaurant) => restaurant.previous !== null);
  const previousTotals = withPrevious ? sum(restaurants.map((restaurant) => restaurant.previous as Totals)) : null;
  const reference = snapshot.comparison?.reference ?? null;

  // Objetivo principal = el de más restaurantes (empate: el menor); el resto se enumera por marca.
  const targetCount = new Map<number, number>();
  for (const restaurant of restaurants) targetCount.set(restaurant.target, (targetCount.get(restaurant.target) ?? 0) + 1);
  const defaultTarget =
    [...targetCount].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? TARGET_AVERAGE;
  const targetByBrand = new Map<string, { brand: string; target: number }>();
  for (const restaurant of restaurants) {
    const key = normalizeBrand(restaurant.brand) || "(sin marca)";
    if (!targetByBrand.has(key)) targetByBrand.set(key, { brand: plainText(restaurant.brand) || "Otras", target: restaurant.target });
  }
  const preferredIndex = (key: string) => {
    const index = (PREFERRED_BRANDS as readonly string[]).indexOf(key);
    return index === -1 ? PREFERRED_BRANDS.length : index;
  };
  const brandTargets = [...targetByBrand]
    .sort((a, b) => preferredIndex(a[0]) - preferredIndex(b[0]) || a[1].brand.localeCompare(b[1].brand, "es"))
    .map(([, value]) => value);

  const priorities = pickPriorities(restaurants);
  const brands = groupBrands(restaurants);

  const companies = [
    ...new Set(
      visible.map((restaurant) => plainText(restaurant.company ?? "")).filter((company) => company !== "")
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return {
    restaurants,
    totals,
    average: averageOf(totals),
    defaultTarget,
    brandTargets,
    uniformTarget: targetCount.size <= 1 ? defaultTarget : null,
    counts: {
      onTarget: restaurants.filter((restaurant) => restaurant.status === "green").length,
      offTarget: restaurants.filter((restaurant) => restaurant.status === "red" || restaurant.status === "yellow").length,
      inactive: restaurants.filter((restaurant) => restaurant.status === "none").length,
    },
    comparison:
      previousTotals && reference
        ? {
            reference,
            previousTotals,
            previousAverage: averageOf(previousTotals),
            previousActive: restaurants.filter((restaurant) => (restaurant.previous?.reviews ?? 0) > 0).length,
          }
        : null,
    newNegativeCount: restaurants.reduce((acc, restaurant) => acc + restaurant.newNegativeCount, 0),
    priorities: priorities.slice(0, MAX_PRIORITIES),
    prioritiesOmitted: Math.max(0, priorities.length - MAX_PRIORITIES),
    brands,
    hidden: snapshot.restaurants.length - visible.length,
    companies,
  };
}
