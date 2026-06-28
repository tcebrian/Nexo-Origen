import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { dedupeResenas } from "@/lib/review-metrics";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { resolveBrandId } from "@/lib/restaurants/brand-resolve";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { getAnalisisForResena, getResenaLookupId } from "@/lib/supabase/analisis-ia";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { resolveResenaRestaurantMeta } from "@/lib/supabase/resenas";
import { buildEmployeeRecord, buildSummaryTrends, buildTalentoSummary } from "./build";
import {
  type DetectedNameMention,
  normalizeEmployeeName,
  toEmployeeMention,
} from "./detect";
import {
  formatEmployeeDisplayName,
  sanitizeEmployeeFieldValue,
} from "./name-validation";
import type { EmployeeRecord, MentionSentiment } from "./types";
import type { TalentoPayload } from "./types";

function sentimentFromAnalisis(label: string | null | undefined): MentionSentiment {
  const value = label?.trim().toLowerCase() ?? "";
  if (/positiv|favorable|buen/.test(value)) return "positive";
  if (/negativ|malo|mal|decepcion/.test(value)) return "negative";
  if (value) return "neutral";
  return "neutral";
}

function detectMentionsFromResenas(
  resenas: ResenaRow[],
  catalogById: Map<number, KpiRestaurantRow>,
  analisisByResenaId: AnalisisIaIndex
): DetectedNameMention[] {
  const detections: DetectedNameMention[] = [];
  const seen = new Set<string>();

  for (const row of resenas) {
    const analisis = getAnalisisForResena(analisisByResenaId, row);
    const employeeName = analisis?.empleado_mencionado?.trim();
    if (!employeeName || !analisis) continue;

    const sanitized = sanitizeEmployeeFieldValue(employeeName);
    const name = sanitized ? formatEmployeeDisplayName(sanitized) : formatEmployeeDisplayName(employeeName);
    if (!name) continue;

    const catalogRows = Array.from(catalogById.values());
    const resolved = resolveResenaRestaurantMeta(row, catalogRows);
    const restaurant = resolved.name;
    const marca = resolved.marca;
    const slug = restaurantSlug(restaurant);
    const brand = resolveBrandId(row.restaurante_id, marca, catalogById);
    const text = row.comentario?.trim() ?? "";
    const reviewId = getResenaLookupId(row);
    if (!reviewId) continue;
    const dateValue = row.fecha_resena ?? row.created_at;
    const detectedAt = dateValue ? new Date(dateValue) : new Date();
    const sentiment = sentimentFromAnalisis(analisis.sentimiento);
    const primaryReason = classifyReviewReason(row, analisis);
    const motives =
      primaryReason === "Otros" || primaryReason === "Sin comentario" ? [] : [primaryReason];

    const key = `${slug}::${normalizeEmployeeName(name)}::${reviewId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    detections.push({
      name,
      normalizedName: name,
      reviewId,
      restaurant,
      restaurantSlug: slug,
      brand,
      excerpt: text.slice(0, 180) || "Sin comentario",
      sentiment,
      motives: motives.length > 0 ? motives : [],
      confidence: 1,
      detectedAt,
    });
  }

  return detections;
}

function aggregateEmployees(
  detections: DetectedNameMention[],
  previousDetections: DetectedNameMention[]
): EmployeeRecord[] {
  const byEmployee = new Map<
    string,
    {
      name: string;
      restaurant: string;
      restaurantSlug: string;
      brand: EmployeeRecord["brand"];
      mentions: ReturnType<typeof toEmployeeMention>[];
    }
  >();

  const prevCounts = new Map<string, { total: number; positive: number }>();

  for (const detection of previousDetections) {
    const key = `${detection.restaurantSlug}::${normalizeEmployeeName(detection.name)}`;
    const current = prevCounts.get(key) ?? { total: 0, positive: 0 };
    current.total += 1;
    if (detection.sentiment === "positive") current.positive += 1;
    prevCounts.set(key, current);
  }

  for (const detection of detections) {
    const key = `${detection.restaurantSlug}::${normalizeEmployeeName(detection.name)}`;
    const entry = byEmployee.get(key) ?? {
      name: detection.name,
      restaurant: detection.restaurant,
      restaurantSlug: detection.restaurantSlug,
      brand: detection.brand,
      mentions: [],
    };
    entry.mentions.push(toEmployeeMention(detection));
    byEmployee.set(key, entry);
  }

  return Array.from(byEmployee.entries()).map(([key, entry]) => {
    const positiveMentions = entry.mentions.filter((m) => m.sentiment === "positive").length;
    const negativeMentions = entry.mentions.filter((m) => m.sentiment === "negative").length;
    const neutralMentions = entry.mentions.filter((m) => m.sentiment === "neutral").length;
    const total = entry.mentions.length;

    const negativeMotives = new Map<string, number>();
    for (const mention of entry.mentions) {
      if (mention.sentiment !== "negative" || !mention.motive) continue;
      negativeMotives.set(mention.motive, (negativeMotives.get(mention.motive) ?? 0) + 1);
    }

    const prev = prevCounts.get(key);
    const mentionGrowth =
      prev && prev.total > 0
        ? Math.round(((total - prev.total) / prev.total) * 100)
        : total > 0
          ? 100
          : 0;

    const currentPositivePct = total > 0 ? Math.round((positiveMentions / total) * 100) : 0;
    const prevPositivePct =
      prev && prev.total > 0 ? Math.round((prev.positive / prev.total) * 100) : 0;
    const sentimentImprovement = currentPositivePct - prevPositivePct;

    const featured = entry.mentions.find((m) => m.excerpt.length > 20)?.excerpt;

    return buildEmployeeRecord({
      id: key,
      name: entry.name,
      restaurant: entry.restaurant,
      restaurantSlug: entry.restaurantSlug,
      brand: entry.brand,
      positiveMentions,
      negativeMentions,
      neutralMentions,
      negativeMotives: Array.from(negativeMotives.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      featuredComment: featured,
      mentionGrowth,
      sentimentImprovement,
      mentions: entry.mentions.sort((a, b) => b.date.getTime() - a.date.getTime()),
    });
  });
}

export function buildEmployeesFromResenas(
  resenas: ResenaRow[],
  catalogRows: KpiRestaurantRow[],
  previousResenas: ResenaRow[] = []
): EmployeeRecord[] {
  return buildTalentoPayload(resenas, catalogRows, previousResenas).employees;
}

export function buildTalentoPayload(
  resenas: ResenaRow[],
  catalogRows: KpiRestaurantRow[],
  previousResenas: ResenaRow[] = [],
  analisisByResenaId: AnalisisIaIndex = new Map(),
  previousAnalisisByResenaId: AnalisisIaIndex = new Map()
): TalentoPayload {
  const catalogById = new Map(catalogRows.map((row) => [row.restaurante_id, row]));
  const current = detectMentionsFromResenas(resenas, catalogById, analisisByResenaId);
  const previous = detectMentionsFromResenas(previousResenas, catalogById, previousAnalisisByResenaId);
  const employees = aggregateEmployees(current, previous).sort(
    (a, b) => b.totalMentions - a.totalMentions
  );
  const prevEmployees = aggregateEmployees(previous, []).sort(
    (a, b) => b.totalMentions - a.totalMentions
  );

  const summary = buildTalentoSummary(employees);
  const prevSummary = buildTalentoSummary(prevEmployees);

  return {
    employees,
    summaryTrends: buildSummaryTrends(summary, prevSummary),
  };
}

/** Evita reprocesar la misma reseña si se llama en batch. */
export function dedupeResenasForTalento(resenas: ResenaRow[]): ResenaRow[] {
  return dedupeResenas(resenas);
}
