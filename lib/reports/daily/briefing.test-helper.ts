import { slotForDate } from "./calendar";
import {
  buildSnapshot,
  type DailyReportSnapshot,
  type NewNegative,
  type RestaurantInfo,
  type WindowMetrics,
} from "./snapshot";

/** Datos de prueba del briefing: construye el snapshot con `buildSnapshot`, igual que el job. */
export type FixtureRestaurant = {
  id: number;
  brand: string;
  name: string;
  /** Media de la ventana actual y nº de reseñas. */
  average?: number;
  reviews?: number;
  negative?: number;
  neutral?: number;
  /** Cifras de ayer/domingo: media y reseñas (`negative` por defecto 0). */
  previous?: { average?: number; reviews: number; negative?: number };
  newNegatives?: NewNegative[];
  target?: number;
  company?: string | null;
  reason?: string | null;
};

const metricsOf = (average: number, reviews: number, negative: number, neutral: number): WindowMetrics => ({
  reviews,
  ratingSum: Math.round(average * reviews * 1000) / 1000,
  positive: Math.max(0, reviews - negative - neutral),
  neutral,
  negative,
});

export function fixtureSnapshot(slotDate: string, restaurants: FixtureRestaurant[], options: { comparison?: boolean } = {}): DailyReportSnapshot {
  const withComparison = options.comparison !== false;
  const infos: RestaurantInfo[] = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    company: r.company === undefined ? "Grupo Demo" : r.company,
    target: r.target ?? 4.4,
  }));
  const metrics = new Map<number, WindowMetrics>();
  const previousMetrics = new Map<number, WindowMetrics>();
  const newNegatives = new Map<number, NewNegative[]>();
  const reasons = new Map<number, string | null>();

  for (const r of restaurants) {
    if ((r.reviews ?? 0) > 0) metrics.set(r.id, metricsOf(r.average ?? 0, r.reviews!, r.negative ?? 0, r.neutral ?? 0));
    if (r.previous && r.previous.reviews > 0) {
      previousMetrics.set(r.id, metricsOf(r.previous.average ?? 0, r.previous.reviews, r.previous.negative ?? 0, 0));
    }
    if (r.newNegatives) newNegatives.set(r.id, r.newNegatives);
    reasons.set(r.id, r.reason ?? null);
  }

  return buildSnapshot({
    slot: slotForDate(slotDate),
    restaurants: infos,
    metrics,
    reasons,
    ...(withComparison ? { previousMetrics, newNegatives } : {}),
  });
}

const negative = (stars: number, reason: string | null, excerpt: string | null, at = "2026-10-13T07:42:10"): NewNegative => ({
  stars,
  reason,
  excerpt,
  at,
});

/** Red de varias marcas, con objetivo distinto en Vault y restaurantes sin actividad. Martes 13/10/2026. */
export function multiBrandFixture(): FixtureRestaurant[] {
  return [
    // Burger King
    {
      id: 1, brand: "Burger King", name: "Burger King Soria", average: 3.7, reviews: 10, negative: 3, reason: "Tiempo de espera",
      previous: { average: 4.0, reviews: 9, negative: 2 },
      newNegatives: [negative(1, "Tiempo de espera", "Demora en el servicio, más de 40 minutos esperando el pedido")],
    },
    { id: 2, brand: "Burger King", name: "Burger King Calahorra", average: 4.08, reviews: 6, negative: 0, neutral: 1, previous: { average: 4.08, reviews: 6 } },
    { id: 3, brand: "Burger King", name: "Burger King Andorra", average: 4.67, reviews: 6, previous: { average: 4.6, reviews: 5 } },
    { id: 4, brand: "Burger King", name: "Burger King Huesca", average: 4.52, reviews: 3, previous: { average: 4.52, reviews: 3 } },
    { id: 5, brand: "Burger King", name: "Burger King Zizur", average: 5, reviews: 10, previous: { average: 5, reviews: 8 } },
    { id: 6, brand: "Burger King", name: "Burger King Calatayud" },
    { id: 7, brand: "Burger King", name: "Burger King Barbastro" },
    // Popeyes
    {
      id: 8, brand: "Popeyes", name: "Popeyes Centro", average: 4.3, reviews: 7, negative: 1, reason: "Calidad del producto",
      previous: { average: 4.5, reviews: 6, negative: 0 },
      newNegatives: [negative(2, "Calidad del producto", "Pollo frío y poco crujiente")],
    },
    { id: 9, brand: "Popeyes", name: "Popeyes Andorra", average: 4.35, reviews: 20, negative: 1, neutral: 1, previous: { average: 4.35, reviews: 19, negative: 1 } },
    // Santa Gloria
    { id: 10, brand: "Santa Gloria", name: "Santa Gloria Zaragoza", average: 4.6, reviews: 20, previous: { average: 4.6, reviews: 18 } },
    { id: 11, brand: "Santa Gloria", name: "Santa Gloria Huesca", average: 4.2, reviews: 5, negative: 1, previous: { average: 4.2, reviews: 5, negative: 1 } },
    // Tim Hortons
    { id: 12, brand: "Tim Hortons", name: "Tim Hortons Norte", average: 4.5, reviews: 8, previous: { average: 4.5, reviews: 8 } },
    // Marcas con un solo local → RESTO (cada una con su objetivo)
    { id: 13, brand: "Vault", name: "Vault", average: 4.6, reviews: 12, negative: 0, target: 4.7, previous: { average: 4.6, reviews: 12 } },
    { id: 14, brand: "Ribs", name: "Ribs Zaragoza", average: 3.9, reviews: 10, negative: 2, previous: { average: 3.9, reviews: 10, negative: 2 } },
    { id: 15, brand: "Sibuya", name: "Sibuya" },
  ];
}
