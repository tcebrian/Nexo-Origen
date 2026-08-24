import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { brands } from "@/app/dashboard/restaurantes/data";
import type { AnalisisIaIndex, AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import { getAnalisisForResena } from "@/lib/supabase/analisis-ia";
import { classifyReviewReason, classifyReviewReasons } from "@/lib/reviews/classify-reason";
import { getReviewPriority, reasonToCategory } from "@/lib/reviews/classify";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { resolveReviewIaFields } from "@/lib/reviews/map-analisis-ia";
import type { Review } from "@/lib/reviews/types";
import { dedupeResenas, getReviewDedupKey } from "@/lib/review-metrics";
import {
  buildMediaImpactIndex,
  type MediaImpactResult,
} from "@/lib/reviews/media-impact";
import { resolveBrandId } from "@/lib/restaurants/brand-resolve";
import { toDateKey } from "@/lib/dates/period";
import type { ResenaTranslation } from "@/lib/translate/resena-translations";
import type { KpiRestaurantRow } from "./kpi-restaurantes";
import type { PeriodQuery } from "./kpi-restaurantes";

export type ResenaRow = {
  id: number | string;
  review_id?: number | string | null;
  restaurante_id?: number | null;
  estrellas: number;
  created_at?: string | null;
  comentario?: string | null;
  autor?: string | null;
  fecha_resena?: string | null;
  /** true si la reseña fue editada tras su publicación original. */
  editada?: boolean | null;
  /** Fecha/hora de la última edición (solo relevante si editada === true). */
  fecha_ultima_edicion?: string | null;
  restaurante_nombre?: string | null;
  restaurante?: string | null;
  marca?: string | null;
  direccion?: string | null;
  empleado_nombre?: string | null;
  empleado?: string | null;
  nombre_empleado?: string | null;
};

/**
 * Fecha de actividad de una reseña: si fue editada y tiene fecha de última
 * edición, esa; si no, la fecha original (o created_at como último recurso).
 * Se usa para decidir en qué periodo cae la reseña y para ordenarla — la
 * fecha original (fecha_resena) se conserva siempre para mostrarla.
 */
export function getResenaActivityDateValue(row: ResenaRow): string | null {
  if (row.editada === true && row.fecha_ultima_edicion) return row.fecha_ultima_edicion;
  return row.fecha_resena ?? row.created_at ?? null;
}

function getInitials(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function normalizeLabel(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function isGenericBrandLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return brands.some(
    (entry) =>
      entry.name.toLowerCase() === normalized || entry.id.toLowerCase() === normalized
  );
}

function buildCatalogById(catalog: KpiRestaurantRow[]): Map<number, KpiRestaurantRow> {
  return new Map(catalog.map((row) => [row.restaurante_id, row]));
}

function findCatalogEntryForResena(
  row: ResenaRow,
  catalogById: Map<number, KpiRestaurantRow>,
  catalog: KpiRestaurantRow[]
): KpiRestaurantRow | undefined {
  if (row.restaurante_id != null) {
    const byId = catalogById.get(row.restaurante_id);
    if (byId) return byId;
  }

  const rowLabel = normalizeLabel(row.restaurante_nombre) || normalizeLabel(row.restaurante);
  const address = normalizeLabel(row.direccion).toLowerCase();
  const marcaFilter = normalizeLabel(row.marca).toLowerCase();

  if (rowLabel && !isGenericBrandLabel(rowLabel)) {
    const normalized = rowLabel.toLowerCase();
    const byName = catalog.find(
      (entry) => entry.restaurante.trim().toLowerCase() === normalized
    );
    if (byName) return byName;
  }

  const scopedCatalog = marcaFilter
    ? catalog.filter((entry) => {
        const marca = entry.marca.trim().toLowerCase();
        return marca.includes(marcaFilter) || marcaFilter.includes(marca);
      })
    : catalog;

  if (address) {
    const byAddress = scopedCatalog.find((entry) => {
      const city = entry.ciudad.trim().toLowerCase();
      const name = entry.restaurante.trim().toLowerCase();
      return (city && address.includes(city)) || (name && address.includes(name));
    });
    if (byAddress) return byAddress;
  }

  if (rowLabel) {
    const label = rowLabel.toLowerCase();
    const byCityInLabel = scopedCatalog.find((entry) => {
      const city = entry.ciudad.trim().toLowerCase();
      return city.length > 2 && label.includes(city);
    });
    if (byCityInLabel) return byCityInLabel;
  }

  return undefined;
}

export type ResenaRestaurantMeta = {
  name: string;
  marca: string;
  location?: string;
  catalogEntry?: KpiRestaurantRow;
};

/** Resuelve restaurante y marca reales priorizando catálogo KPI / restaurantes. */
export function resolveResenaRestaurantMeta(
  row: ResenaRow,
  catalog: KpiRestaurantRow[]
): ResenaRestaurantMeta {
  const catalogById = buildCatalogById(catalog);
  const catalogEntry = findCatalogEntryForResena(row, catalogById, catalog);
  const rowLabel = normalizeLabel(row.restaurante_nombre) || normalizeLabel(row.restaurante);

  const name =
    normalizeLabel(catalogEntry?.restaurante) ||
    (rowLabel && !isGenericBrandLabel(rowLabel) ? rowLabel : "") ||
    rowLabel ||
    "Restaurante";

  const marca = normalizeLabel(catalogEntry?.marca) || normalizeLabel(row.marca);
  const location =
    normalizeLabel(row.direccion) || normalizeLabel(catalogEntry?.ciudad) || undefined;

  return { name, marca, location, catalogEntry };
}

function resolveReviewBrandLabel(brand: ReturnType<typeof resolveBrandId>, marca: string): string {
  return brands.find((entry) => entry.id === brand)?.name ?? marca;
}

export function mapResenaToReview(
  row: ResenaRow,
  restaurantName: string,
  marca: string,
  catalogMarca?: string,
  mediaImpact?: MediaImpactResult | null,
  analisis?: AnalisisIaRow | null,
  options?: {
    location?: string;
    catalogById?: Map<number, KpiRestaurantRow>;
    translation?: ResenaTranslation;
  }
): Review {
  const resolvedMarca = catalogMarca || marca;
  const catalogById = options?.catalogById;
  const brand = resolveBrandId(row.restaurante_id, resolvedMarca, catalogById);
  const brandLabel = resolveReviewBrandLabel(brand, resolvedMarca || marca);
  const slug = restaurantSlug(restaurantName);
  const rating = row.estrellas;
  const originalComment = row.comentario?.trim() || "Sin comentario";
  const translation = options?.translation;
  const text = translation?.text.trim() || originalComment;
  const author = row.autor?.trim() || "Anónimo";
  const dateValue = row.fecha_resena ?? row.created_at;
  const date = dateValue ? new Date(dateValue) : new Date();
  const editada = row.editada === true;
  const activityDateValue = getResenaActivityDateValue(row);
  const activityDate = activityDateValue ? new Date(activityDateValue) : date;

  const mediaBefore = mediaImpact?.mediaBefore ?? null;
  const mediaAfter = mediaImpact?.mediaAfter ?? null;
  const mediaImpactValue = mediaImpact?.impact ?? null;

  const iaFields = resolveReviewIaFields(
    analisis ?? null,
    { rating, mediaBefore, mediaAfter, mediaImpact: mediaImpactValue },
    mediaImpact
  );

  const primaryReason = classifyReviewReason(row, analisis ?? null);
  const detectedReasons = classifyReviewReasons(row, analisis ?? null);
  const category = reasonToCategory(primaryReason);

  const operationalSentiment =
    rating <= 2 ? "negativa" : rating === 3 ? "neutral" : "positiva";

  return {
    id: String(row.review_id ?? row.id),
    reviewId: row.review_id != null ? String(row.review_id).trim() || null : null,
    resenaId: String(row.id),
    author,
    initials: getInitials(author),
    rating,
    restaurant: restaurantName,
    restaurantSlug: slug,
    brand,
    brandLabel,
    text,
    originalText: translation ? originalComment : undefined,
    originalLanguage: translation ? translation.detectedLanguage : undefined,
    date,
    activityDate,
    editada,
    location: options?.location ?? row.direccion ?? undefined,
    source: "google",
    sentiment: iaFields.iaPending ? operationalSentiment : iaFields.sentiment,
    category,
    priority: iaFields.ai?.priority ?? getReviewPriority(rating, operationalSentiment, category),
    estimatedImpact: iaFields.impactLabel,
    mediaBefore,
    mediaAfter,
    mediaImpact: mediaImpactValue,
    sentimentLabel: iaFields.sentimentLabel,
    motiveLabel: primaryReason,
    riskLevel: iaFields.riskLevel,
    impactLabel: iaFields.impactLabel,
    employeeMentioned: iaFields.employeeMentioned,
    iaPending: iaFields.iaPending,
    recommendedAction: iaFields.recommendedAction,
    reviewed: false,
    analyzed: iaFields.analyzed,
    ai: iaFields.ai
      ? {
          ...iaFields.ai,
          motives: [
            ...detectedReasons,
            ...iaFields.ai.motives.filter(
              (motive) =>
                !detectedReasons.includes(motive as (typeof detectedReasons)[number]) &&
                motive !== IA_NO_DATA
            ),
          ],
        }
      : undefined,
  };
}

/** Carga reseñas en el navegador vía API autenticada. */
export async function fetchResenasForPeriod(
  query: PeriodQuery,
  options?: { restaurantSlug?: string; restauranteId?: number }
): Promise<ResenaRow[]> {
  const startKey = toDateKey(query.start);
  const endKey = toDateKey(query.end);
  const params = new URLSearchParams({ start: startKey, end: endKey });
  if (options?.restauranteId != null) {
    params.set("restaurante_id", String(options.restauranteId));
  }
  if (options?.restaurantSlug) {
    params.set("restaurant_slug", options.restaurantSlug);
  }

  const response = await fetch(`/api/resenas?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    console.error("[fetchResenasForPeriod] API error:", response.status);
    return [];
  }
  return (await response.json()) as ResenaRow[];
}

export async function fetchReviewsForPeriod(
  query: PeriodQuery,
  catalog: KpiRestaurantRow[]
): Promise<Review[]> {
  const rows = await fetchResenasForPeriod(query);
  const impactIndex = buildMediaImpactIndex(rows);
  const catalogById = buildCatalogById(catalog);

  return rows.map((row) => {
    const meta = resolveResenaRestaurantMeta(row, catalog);
    const impact = impactIndex.get(getReviewDedupKey(row));
    return mapResenaToReview(
      row,
      meta.name,
      meta.marca,
      meta.catalogEntry?.marca,
      impact,
      undefined,
      { location: meta.location, catalogById }
    );
  });
}

export function mapResenasToReviews(
  resenas: ResenaRow[],
  catalog: KpiRestaurantRow[],
  options?: {
    impactIndex?: Map<string, MediaImpactResult>;
    analisisByResenaId?: AnalisisIaIndex;
    translationsByResenaId?: Map<string, ResenaTranslation>;
  }
): Review[] {
  const catalogById = buildCatalogById(catalog);
  const impactIndex = options?.impactIndex ?? buildMediaImpactIndex(resenas);

  return resenas.map((row) => {
    const meta = resolveResenaRestaurantMeta(row, catalog);
    const impact = impactIndex.get(getReviewDedupKey(row));
    const analisis = options?.analisisByResenaId
      ? getAnalisisForResena(options.analisisByResenaId, row)
      : undefined;
    const translation = options?.translationsByResenaId?.get(String(row.id));

    return mapResenaToReview(
      row,
      meta.name,
      meta.marca,
      meta.catalogEntry?.marca,
      impact,
      analisis,
      { location: meta.location, catalogById, translation }
    );
  });
}

export function buildRestaurantMap(
  rows: { restaurante_id: number; restaurante: string; marca: string }[]
): Map<number, { name: string; marca: string }> {
  return new Map(
    rows.map((row) => [
      row.restaurante_id,
      { name: row.restaurante, marca: row.marca },
    ])
  );
}

