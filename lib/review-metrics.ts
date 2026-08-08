import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { classifyReviewReason, type ReviewPrimaryReason } from "@/lib/reviews/classify-reason";
import type { Review } from "@/lib/reviews/types";
import type { KpiDiarioRow } from "@/lib/supabase/kpi-diario";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { getAnalisisForResena } from "@/lib/supabase/analisis-ia";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";

export const REPUTATION_TARGET = 4.4;

export type StarCounts = {
  stars1: number;
  stars2: number;
  stars3: number;
  stars4: number;
  stars5: number;
};

export type RestaurantPeriodMetrics = {
  restauranteId: number;
  restaurante: string;
  ciudad: string;
  marca: string;
  brand: BrandId;
  slug: string;
  totalResenas: number;
  media: number;
  resenasPositivas: number;
  resenasNegativas: number;
  stars: StarCounts;
  statusLabel: "Óptimo" | "En riesgo" | "Crítico";
  operationalStatus: "on_target" | "watch" | "critical";
  ultimaResena: string | null;
};

export type ProblemDistributionItem = {
  label: string;
  count: number;
  percent: number;
  /** true si el motivo viene de heurística local (legacy). */
  provisional?: boolean;
};

export type TopReasonItem = {
  motivo: ReviewPrimaryReason;
  count: number;
  percent: number;
  restaurantesAfectados: number;
};

export type GetTopReasonsOptions = {
  negativesOnly?: boolean;
  restauranteId?: number;
  limit?: number;
};

export type NetworkPeriodMetrics = {
  mediaGlobal: number;
  totalResenas: number;
  totalPositivas: number;
  totalNegativas: number;
  totalRestaurantes: number;
  positivePct: number;
  negativePct: number;
  ultimaActualizacion: string | null;
  source: "resenas" | "kpi_diario" | "empty";
};

export type PeriodMetricsResult = {
  byRestaurante: Map<number, RestaurantPeriodMetrics>;
  network: NetworkPeriodMetrics;
  problemDistribution: ProblemDistributionItem[];
};

const PROBLEM_LABELS = [
  "Tiempo de espera",
  "Atención",
  "Calidad producto",
  "Limpieza",
  "Error pedido",
  "Ruido/Saturación",
  "Otros",
] as const;

export type ProblemLabel = (typeof PROBLEM_LABELS)[number];

function normalizeReviewText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeReviewDateKey(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return value.trim().slice(0, 10);
}

/** Firma de contenido: mismo local + fecha + autor + estrellas + comentario. */
export function getReviewContentKey(row: ResenaRow): string {
  const restauranteId = row.restaurante_id ?? 0;
  const restaurant = normalizeReviewText(row.restaurante);
  const fecha = normalizeReviewDateKey(row.fecha_resena ?? row.created_at);
  const autor = normalizeReviewText(row.autor);
  const comentario = normalizeReviewText(row.comentario);
  const estrellas = row.estrellas;

  if (!comentario && !autor) {
    return `row_id:${row.id}`;
  }

  return `content:${restauranteId}:${restaurant}:${fecha}:${autor}:${estrellas}:${comentario}`;
}

export function getReviewDedupKey(row: ResenaRow): string {
  const reviewId = row.review_id != null ? String(row.review_id).trim() : "";
  if (reviewId) return `review_id:${reviewId}`;
  return getReviewContentKey(row);
}

function hasReviewId(row: ResenaRow): boolean {
  return row.review_id != null && String(row.review_id).trim() !== "";
}

function resenaTimestamp(row: ResenaRow): number {
  const value = row.fecha_resena ?? row.created_at;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function choosePreferredResena(existing: ResenaRow, candidate: ResenaRow): ResenaRow {
  const existingHasReviewId = hasReviewId(existing);
  const candidateHasReviewId = hasReviewId(candidate);
  if (candidateHasReviewId && !existingHasReviewId) return candidate;
  if (existingHasReviewId && !candidateHasReviewId) return existing;

  const existingTime = resenaTimestamp(existing);
  const candidateTime = resenaTimestamp(candidate);
  if (candidateTime !== existingTime) {
    return candidateTime >= existingTime ? candidate : existing;
  }

  return Number(candidate.id) >= Number(existing.id) ? candidate : existing;
}

function dedupeResenasWithKey(
  rows: ResenaRow[],
  keyFn: (row: ResenaRow) => string
): ResenaRow[] {
  const byKey = new Map<string, ResenaRow>();

  for (const row of rows) {
    const key = keyFn(row);
    const existing = byKey.get(key);
    byKey.set(key, existing ? choosePreferredResena(existing, row) : row);
  }

  return Array.from(byKey.values());
}

/**
 * Elimina duplicados:
 * 1) por review_id (analisis_ia.review_id)
 * 2) por contenido (misma reseña importada con otro review_id)
 */
export function dedupeResenas(rows: ResenaRow[]): ResenaRow[] {
  if (rows.length <= 1) return rows;

  const byReviewId = dedupeResenasWithKey(rows, (row) => {
    const reviewId = row.review_id != null ? String(row.review_id).trim() : "";
    return reviewId ? `review_id:${reviewId}` : `row_id:${row.id}`;
  });

  return dedupeResenasWithKey(byReviewId, getReviewContentKey);
}

export function emptyStarCounts(): StarCounts {
  return { stars1: 0, stars2: 0, stars3: 0, stars4: 0, stars5: 0 };
}

function bumpStar(stars: StarCounts, rating: number) {
  if (rating === 1) stars.stars1 += 1;
  else if (rating === 2) stars.stars2 += 1;
  else if (rating === 3) stars.stars3 += 1;
  else if (rating === 4) stars.stars4 += 1;
  else if (rating >= 5) stars.stars5 += 1;
}

export function classifyMediaStatus(media: number, hasReviews: boolean): {
  statusLabel: RestaurantPeriodMetrics["statusLabel"];
  operationalStatus: RestaurantPeriodMetrics["operationalStatus"];
} {
  if (!hasReviews) {
    return { statusLabel: "En riesgo", operationalStatus: "watch" };
  }
  if (media >= REPUTATION_TARGET) {
    return { statusLabel: "Óptimo", operationalStatus: "on_target" };
  }
  if (media >= 4.0) {
    return { statusLabel: "En riesgo", operationalStatus: "watch" };
  }
  return { statusLabel: "Crítico", operationalStatus: "critical" };
}

export function classifyProblemLabel(text: string, rating: number): ProblemLabel {
  const reason = classifyReviewReason({ comentario: text });
  switch (reason) {
    case "Tiempo de espera":
      return "Tiempo de espera";
    case "Atención al cliente":
      return "Atención";
    case "Calidad producto":
      return "Calidad producto";
    case "Limpieza":
      return "Limpieza";
    case "Pedido incorrecto":
      return "Error pedido";
    case "Ambiente/local":
      return "Ruido/Saturación";
    default:
      if (rating <= 2) return "Otros";
      return "Otros";
  }
}

function aggregateTopReasonCounts(
  entries: { reason: ReviewPrimaryReason; restauranteId: number | null | undefined }[]
): TopReasonItem[] {
  const counts = new Map<ReviewPrimaryReason, { count: number; restaurants: Set<number> }>();

  for (const entry of entries) {
    const current = counts.get(entry.reason) ?? { count: 0, restaurants: new Set<number>() };
    current.count += 1;
    if (entry.restauranteId != null) current.restaurants.add(entry.restauranteId);
    counts.set(entry.reason, current);
  }

  const total = entries.length;
  if (total === 0) return [];

  return Array.from(counts.entries())
    .map(([motivo, stats]) => ({
      motivo,
      count: stats.count,
      percent: Math.round((stats.count / total) * 1000) / 10,
      restaurantesAfectados: stats.restaurants.size,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getTopReasons(
  reviews: ResenaRow[] | Review[],
  analisisByResenaId: AnalisisIaIndex = new Map(),
  options: GetTopReasonsOptions = {}
): TopReasonItem[] {
  const { negativesOnly = false, restauranteId, limit } = options;
  const entries: { reason: ReviewPrimaryReason; restauranteId: number | null | undefined }[] = [];

  if (reviews.length === 0) return [];

  const first = reviews[0];
  const isDomainReview = "text" in first && "rating" in first;

  if (isDomainReview) {
    for (const review of reviews as Review[]) {
      if (negativesOnly && review.rating > 3) continue;
      entries.push({
        reason: classifyReviewReason(review),
        restauranteId: undefined,
      });
    }
  } else {
    for (const row of dedupeResenas(reviews as ResenaRow[])) {
      if (restauranteId != null && row.restaurante_id !== restauranteId) continue;
      if (negativesOnly && row.estrellas > 3) continue;
      const analisis = getAnalisisForResena(analisisByResenaId, row);
      entries.push({
        reason: classifyReviewReason(row, analisis),
        restauranteId: row.restaurante_id,
      });
    }
  }

  const ranked = aggregateTopReasonCounts(entries);
  return limit ? ranked.slice(0, limit) : ranked;
}

export function buildProblemDistributionFromAnalisis(
  resenas: ResenaRow[],
  analisisByResenaId: AnalisisIaIndex
): ProblemDistributionItem[] {
  return getTopReasons(resenas, analisisByResenaId, { negativesOnly: true }).map((item) => ({
    label: item.motivo,
    count: item.count,
    percent: item.percent,
    provisional: false,
  }));
}

/** @deprecated Usar buildProblemDistributionFromAnalisis con datos de Supabase. */
export function buildProblemDistribution(resenas: ResenaRow[]): ProblemDistributionItem[] {
  const negatives = dedupeResenas(resenas).filter((row) => row.estrellas <= 3);
  const counts = new Map<string, number>();

  for (const row of negatives) {
    const label = classifyProblemLabel(row.comentario ?? "", row.estrellas);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 1000) / 10,
      provisional: true as const,
    }));
}

function createRestaurantBase(
  catalog: KpiRestaurantRow,
  period?: Partial<RestaurantPeriodMetrics>
): RestaurantPeriodMetrics {
  const media = period?.media ?? 0;
  const totalResenas = period?.totalResenas ?? 0;
  const { statusLabel, operationalStatus } = classifyMediaStatus(media, totalResenas > 0);

  return {
    restauranteId: catalog.restaurante_id,
    restaurante: catalog.restaurante,
    ciudad: catalog.ciudad,
    marca: catalog.marca,
    brand: marcaToBrandId(catalog.marca),
    slug: restaurantSlug(catalog.restaurante),
    totalResenas,
    media,
    resenasPositivas: period?.resenasPositivas ?? 0,
    resenasNegativas: period?.resenasNegativas ?? 0,
    stars: period?.stars ?? emptyStarCounts(),
    statusLabel,
    operationalStatus,
    ultimaResena: period?.ultimaResena ?? catalog.ultima_resena,
  };
}

function aggregateFromResenas(
  resenas: ResenaRow[],
  catalogById: Map<number, KpiRestaurantRow>
): Map<number, RestaurantPeriodMetrics> {
  const map = new Map<number, RestaurantPeriodMetrics>();

  for (const row of dedupeResenas(resenas)) {
    const restauranteId = row.restaurante_id;
    if (restauranteId == null) continue;

    const catalog = catalogById.get(restauranteId);
    const estrellas = row.estrellas;
    const current = map.get(restauranteId) ?? createRestaurantBase(
      catalog ?? {
        restaurante_id: restauranteId,
        restaurante: row.restaurante ?? `Restaurante ${restauranteId}`,
        ciudad: "",
        marca: row.marca ?? "Otros",
        total_resenas: 0,
        media_total: 0,
        resenas_negativas: 0,
        resenas_positivas: 0,
        ultima_resena: null,
        estado: "",
        media_google: null,
        total_resenas_google: null,
      }
    );

    current.totalResenas += 1;
    if (estrellas >= 4) current.resenasPositivas += 1;
    if (estrellas <= 2) current.resenasNegativas += 1;
    bumpStar(current.stars, estrellas);
    current.media =
      (current.media * (current.totalResenas - 1) + estrellas) / current.totalResenas;

    const fecha = row.fecha_resena ?? row.created_at;
    if (fecha && (!current.ultimaResena || fecha > current.ultimaResena)) {
      current.ultimaResena = fecha;
    }

    const status = classifyMediaStatus(current.media, true);
    current.statusLabel = status.statusLabel;
    current.operationalStatus = status.operationalStatus;

    map.set(restauranteId, current);
  }

  return map;
}

function aggregateFromKpiDiario(
  rows: KpiDiarioRow[],
  catalogById: Map<number, KpiRestaurantRow>
): Map<number, RestaurantPeriodMetrics> {
  const acc = new Map<
    number,
    {
      totalResenas: number;
      sumRating: number;
      negativas: number;
      positivas: number;
    }
  >();

  for (const row of rows) {
    if (row.restaurante_id <= 0) continue;
    const current = acc.get(row.restaurante_id) ?? {
      totalResenas: 0,
      sumRating: 0,
      negativas: 0,
      positivas: 0,
    };
    current.totalResenas += row.total_resenas;
    current.sumRating += row.media * row.total_resenas;
    current.negativas += row.negativas;
    current.positivas += row.positivas;
    acc.set(row.restaurante_id, current);
  }

  const map = new Map<number, RestaurantPeriodMetrics>();

  for (const [restauranteId, totals] of acc) {
    const catalog = catalogById.get(restauranteId);
    if (!catalog) continue;
    const media = totals.totalResenas > 0 ? totals.sumRating / totals.totalResenas : 0;
    const status = classifyMediaStatus(media, totals.totalResenas > 0);

    map.set(restauranteId, {
      ...createRestaurantBase(catalog, {
        totalResenas: totals.totalResenas,
        media,
        resenasPositivas: totals.positivas,
        resenasNegativas: totals.negativas,
        stars: emptyStarCounts(),
      }),
      statusLabel: status.statusLabel,
      operationalStatus: status.operationalStatus,
    });
  }

  return map;
}

function buildNetworkMetrics(
  byRestaurante: Map<number, RestaurantPeriodMetrics>,
  source: NetworkPeriodMetrics["source"],
  ultimaActualizacion: string | null
): NetworkPeriodMetrics {
  let totalResenas = 0;
  let totalPositivas = 0;
  let totalNegativas = 0;
  let weightedSum = 0;

  for (const row of byRestaurante.values()) {
    totalResenas += row.totalResenas;
    totalPositivas += row.resenasPositivas;
    totalNegativas += row.resenasNegativas;
    weightedSum += row.media * row.totalResenas;
  }

  const mediaGlobal = totalResenas > 0 ? weightedSum / totalResenas : 0;

  return {
    mediaGlobal,
    totalResenas,
    totalPositivas,
    totalNegativas,
    totalRestaurantes: byRestaurante.size,
    positivePct: totalResenas > 0 ? Math.round((totalPositivas / totalResenas) * 1000) / 10 : 0,
    negativePct: totalResenas > 0 ? Math.round((totalNegativas / totalResenas) * 1000) / 10 : 0,
    ultimaActualizacion,
    source,
  };
}

function latestTimestamp(resenas: ResenaRow[]): string | null {
  let latest: string | null = null;
  for (const row of resenas) {
    const value = row.fecha_resena ?? row.created_at;
    if (!value) continue;
    if (!latest || value > latest) latest = value;
  }
  return latest;
}

/** Métricas del periodo agrupadas siempre por restaurante_id. */
export function buildPeriodMetrics(input: {
  catalog: KpiRestaurantRow[];
  resenas: ResenaRow[];
  kpiDiario: KpiDiarioRow[];
  analisisByResenaId?: AnalisisIaIndex;
}): PeriodMetricsResult {
  const catalogById = new Map(input.catalog.map((row) => [row.restaurante_id, row]));
  const deduped = dedupeResenas(input.resenas);

  let periodById: Map<number, RestaurantPeriodMetrics>;
  let source: NetworkPeriodMetrics["source"] = "empty";

  if (deduped.length > 0) {
    periodById = aggregateFromResenas(deduped, catalogById);
    source = "resenas";
  } else if (input.kpiDiario.length > 0) {
    periodById = aggregateFromKpiDiario(input.kpiDiario, catalogById);
    source = "kpi_diario";
  } else {
    periodById = new Map();
  }

  const byRestaurante = new Map<number, RestaurantPeriodMetrics>();

  for (const catalogRow of input.catalog) {
    const period = periodById.get(catalogRow.restaurante_id);
    byRestaurante.set(
      catalogRow.restaurante_id,
      period ??
        createRestaurantBase(catalogRow, {
          totalResenas: 0,
          media: 0,
          resenasPositivas: 0,
          resenasNegativas: 0,
          stars: emptyStarCounts(),
        })
    );
  }

  const network = buildNetworkMetrics(
    byRestaurante,
    source,
    latestTimestamp(deduped) ?? null
  );

  return {
    byRestaurante,
    network,
    problemDistribution: input.analisisByResenaId
      ? buildProblemDistributionFromAnalisis(deduped, input.analisisByResenaId)
      : [],
  };
}

export function metricsToKpiRow(
  catalog: KpiRestaurantRow,
  metrics: RestaurantPeriodMetrics
): KpiRestaurantRow {
  return {
    ...catalog,
    total_resenas: metrics.totalResenas,
    media_total: metrics.media,
    resenas_negativas: metrics.resenasNegativas,
    resenas_positivas: metrics.resenasPositivas,
    ultima_resena: metrics.ultimaResena,
    estado: metrics.statusLabel,
  };
}

export function sortRankingMetrics(rows: RestaurantPeriodMetrics[]): RestaurantPeriodMetrics[] {
  return [...rows].sort((a, b) => {
    if (b.media !== a.media) return b.media - a.media;
    return b.totalResenas - a.totalResenas;
  });
}
