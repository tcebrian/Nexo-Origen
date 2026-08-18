import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { sortResenasByDateDesc } from "@/lib/restaurants/reputation-metrics";
import { dedupeResenas, getReviewDedupKey, getReviewContentKey } from "@/lib/review-metrics";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { getAnalisisForResena } from "@/lib/supabase/analisis-ia";
import { buildMediaImpactIndex } from "@/lib/reviews/media-impact";
import type { PeriodData } from "@/lib/supabase/period-stats";
import { resolveResenaRestaurantMeta } from "@/lib/supabase/resenas";
import type { NegativeReviewReportRow, NegativeReviewsQuery } from "./types";

const DEFAULT_BRANDS: BrandId[] = ["bk"];

function getReportRowDedupKey(row: NegativeReviewReportRow): string {
  const comment = row.comment.trim().toLowerCase().replace(/\s+/g, " ");
  const author = row.author.trim().toLowerCase();
  const date = row.dateIso.slice(0, 10);
  return `${row.restaurantSlug}|${date}|${author}|${row.stars}|${comment}`;
}

function dedupeNegativeReviewReportRows(rows: NegativeReviewReportRow[]): NegativeReviewReportRow[] {
  const seen = new Set<string>();
  const unique: NegativeReviewReportRow[] = [];

  for (const row of rows) {
    const key = getReportRowDedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

function formatReviewDate(raw: string | null | undefined): { iso: string; label: string } {
  if (!raw) {
    const now = new Date();
    return { iso: now.toISOString(), label: "Fecha no disponible" };
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { iso: raw, label: raw };
  }
  return {
    iso: date.toISOString(),
    label: date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

export function buildNegativeReviewReportRows(
  period: PeriodData,
  query: NegativeReviewsQuery
): NegativeReviewReportRow[] {
  const allowedBrands = new Set(query.brands ?? DEFAULT_BRANDS);
  const limit = query.limit ?? 50;

  const catalogById = new Map(
    period.catalog.map((row) => [row.restaurante_id, row])
  );
  const impactIndex = buildMediaImpactIndex(period.resenas);

  const negatives = sortResenasByDateDesc(
    dedupeResenas(period.resenas).filter((row) => row.estrellas <= 3)
  );

  const rows: NegativeReviewReportRow[] = [];
  const seenResenas = new Set<string>();

  for (const row of negatives) {
    if (rows.length >= limit) break;

    const resenaKey = getReviewContentKey(row);
    if (seenResenas.has(resenaKey)) continue;
    seenResenas.add(resenaKey);

    const catalog = row.restaurante_id != null ? catalogById.get(row.restaurante_id) : undefined;
    const resolved = resolveResenaRestaurantMeta(row, period.catalog);
    const restaurantName = resolved.name;
    const marca = resolved.marca;
    const brand = marcaToBrandId(marca);

    if (!allowedBrands.has(brand)) continue;

    const impact = impactIndex.get(getReviewDedupKey(row));
    const text = row.comentario?.trim() || "Sin comentario";
    const analisis = getAnalisisForResena(period.analisisByResenaId, row);
    const motive = classifyReviewReason(row, analisis);
    const detectedReasons = motive === "Otros" || motive === "Sin comentario" ? [] : [motive];
    const { iso, label } = formatReviewDate(row.fecha_resena ?? row.created_at);

    rows.push({
      id: String(row.review_id ?? row.id),
      restauranteId: row.restaurante_id ?? null,
      restaurant: restaurantName,
      restaurantSlug: restaurantSlug(restaurantName),
      brand,
      brandLabel: marca || "Burger King",
      city: catalog?.ciudad?.trim() || "",
      address: resolved.location?.trim() || catalog?.ciudad || "—",
      author: row.autor?.trim() || "Anónimo",
      dateIso: iso,
      dateLabel: label,
      stars: row.estrellas,
      comment: text,
      motive: motive === "Sin comentario" ? IA_NO_DATA : motive,
      detectedReasons,
      sentiment: analisis?.sentimiento?.trim() || IA_NO_DATA,
      riskLevel: analisis?.riesgo?.trim() || IA_NO_DATA,
      aiSummary: analisis?.resumen?.trim() || null,
      analisisPending: !analisis,
      mediaBefore: impact?.mediaBefore ?? null,
      mediaAfter: impact?.mediaAfter ?? null,
      impact: impact?.impact ?? null,
      impactText:
        analisis?.impacto?.trim() ||
        (impact
          ? `${impact.mediaBefore?.toFixed(2) ?? "—"} → ${impact.mediaAfter.toFixed(2)}`
          : IA_NO_DATA),
      recommendation: analisis?.recomendacion?.trim() || IA_NO_DATA,
      employeeMentioned: analisis?.empleado_mencionado?.trim() || null,
      reviewCountAfter: impact?.reviewCountAfter ?? null,
      totalReviews: catalog && catalog.total_resenas > 0 ? catalog.total_resenas : null,
      lifetimeMedia: catalog && catalog.total_resenas > 0 ? catalog.media_total : null,
    });
  }

  return dedupeNegativeReviewReportRows(rows);
}
