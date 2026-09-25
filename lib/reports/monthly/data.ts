import "server-only";

import type { UserScope } from "@/lib/auth/types";
import { assertRestauranteInScope } from "@/lib/auth/data-scope";
import { dedupeResenas } from "@/lib/review-metrics";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { resolveReportPeriodRange } from "@/lib/reports/period-ranges";
import { categoriaMotivoLabel } from "@/lib/supabase/resena-motivos";
import { fetchResenaMotivosForReviewIds } from "@/lib/supabase/resena-motivos.server";
import { fetchSupabaseCanonicalReputationMetrics, type SupabaseMetricRow } from "@/lib/supabase/reputation-metrics.server";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { getResenaActivityDateValue, type ResenaRow } from "@/lib/supabase/resenas";

export type MonthlyRestaurant = {
  id: number;
  name: string;
  brand: string;
  city: string;
  address: string;
  company: string;
  target: number;
  total: number;
  average: number | null;
};

export type MonthlyReview = {
  id: string;
  author: string;
  date: string;
  editedAt: string | null;
  stars: number;
  comment: string;
  reason: string | null;
};

export type MonthlyReportData = {
  restaurant: MonthlyRestaurant;
  label: string;
  startKey: string;
  endKey: string;
  current: SupabaseMetricRow;
  previous: SupabaseMetricRow;
  weeks: { label: string; total: number; average: number | null; positive: number; neutral: number; negative: number }[];
  reviews: MonthlyReview[];
  reasons: { label: string; count: number; percent: number }[];
};

type CatalogRow = {
  restaurante_id: number | string;
  restaurante: string;
  marca: string;
  ciudad: string;
  direccion: string;
  empresa: string;
  objetivo_media: number | string;
};

const n = (value: unknown) => Number(value) || 0;
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const norm = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function monthlyPeriod(offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 36) throw new Error("Periodo no válido");
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("-").map(Number);
  const period = resolveReportPeriodRange("mensual", offset, new Date(year, month - 1, day, 12));
  return period;
}

async function catalog(ids: number[] | null): Promise<CatalogRow[]> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_restaurant_catalog", { p_restaurant_ids: ids });
  if (error) throw new Error(`No se pudo consultar el catálogo: ${error.message}`);
  return (data ?? []) as CatalogRow[];
}

export async function listMonthlyRestaurants(brand: string, offset: number, scope: UserScope): Promise<{
  period: ReturnType<typeof monthlyPeriod>;
  restaurants: MonthlyRestaurant[];
}> {
  const period = monthlyPeriod(offset);
  const rows = (await catalog(null)).filter(
    (r) => norm(r.marca) === norm(brand) && assertRestauranteInScope(scope, n(r.restaurante_id))
  );
  const ids = rows.map((r) => n(r.restaurante_id));
  const metrics = await fetchSupabaseCanonicalReputationMetrics(period.startKey, period.endKey, ids);
  const byId = new Map(metrics.map((r) => [n(r.restaurante_id), r]));
  return {
    period,
    restaurants: rows.map((r) => {
      const metric = byId.get(n(r.restaurante_id));
      const total = n(metric?.total_resenas);
      return {
        id: n(r.restaurante_id), name: r.restaurante, brand: r.marca,
        city: r.ciudad ?? "", address: r.direccion ?? "", company: r.empresa ?? "",
        target: n(r.objetivo_media) || 4.4, total,
        average: total ? n(metric?.media_exacta) : null,
      };
    }),
  };
}

function activityKey(row: ResenaRow): string {
  if (row.editada && row.fecha_ultima_edicion) {
    const date = new Date(row.fecha_ultima_edicion);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  return (row.fecha_resena ?? row.created_at ?? "").slice(0, 10);
}

async function loadReviews(restaurantId: number, startKey: string, endKey: string): Promise<ResenaRow[]> {
  const client = await getSupabaseDataClientForServer();
  // The activity date may be the edit date. Include originals and edits, then
  // assign each review to precisely one month using the canonical date rule.
  const [endYear, endMonth, endDay] = endKey.split("-").map(Number);
  // One extra day on each side catches UTC timestamps around Madrid midnight.
  const endExclusiveIso = key(new Date(endYear, endMonth - 1, endDay + 2));
  const beginning = key(new Date(Number(startKey.slice(0, 4)), Number(startKey.slice(5, 7)) - 1, Number(startKey.slice(8)) - 1));
  const within = (column: string) => `${column}.gte.${beginning},${column}.lt.${endExclusiveIso}`;
  const filter = [
    `and(${within("fecha_resena")})`,
    `and(${within("fecha_ultima_edicion")})`,
    `and(fecha_resena.is.null,${within("created_at")})`,
  ].join(",");
  const rows: ResenaRow[] = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await client.from("resenas")
      .select("id,review_id,restaurante_id,autor,estrellas,comentario,fecha_resena,created_at,editada,fecha_ultima_edicion,restaurante_nombre")
      .eq("restaurante_id", restaurantId).or(filter).order("id", { ascending: true })
      .range(page * 500, page * 500 + 499);
    if (error) throw new Error(`No se pudo consultar el registro de reseñas: ${error.message}`);
    rows.push(...((data ?? []) as ResenaRow[]).map((row) => ({
      ...row, restaurante: row.restaurante_nombre,
    })));
    if ((data ?? []).length < 500) break;
    if (page === 29) throw new Error("El registro de reseñas supera el límite de paginación");
  }
  return dedupeResenas(rows.filter((r) => {
    const date = activityKey(r);
    return date >= startKey && date <= endKey;
  })).sort((a, b) => (getResenaActivityDateValue(b) ?? "").localeCompare(getResenaActivityDateValue(a) ?? ""));
}

export async function loadMonthlyReport(restaurantId: number, offset: number, scope: UserScope): Promise<MonthlyReportData | null> {
  if (!Number.isSafeInteger(restaurantId) || restaurantId <= 0 || !assertRestauranteInScope(scope, restaurantId)) return null;
  const [row] = await catalog([restaurantId]);
  if (!row) return null;
  const period = monthlyPeriod(offset);
  const previousPeriod = monthlyPeriod(offset + 1);
  const weeks: { start: string; end: string; label: string }[] = [];
  let cursor = new Date(`${period.startKey}T12:00:00Z`);
  while (key(cursor) <= period.endKey) {
    const first = key(cursor);
    const day = cursor.getUTCDay();
    const untilSunday = day === 0 ? 0 : 7 - day;
    const last = new Date(cursor);
    last.setUTCDate(last.getUTCDate() + untilSunday);
    const end = key(last) > period.endKey ? period.endKey : key(last);
    weeks.push({ start: first, end, label: `${first.slice(8)}/${first.slice(5, 7)} - ${end.slice(8)}/${end.slice(5, 7)}` });
    cursor = new Date(`${end}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const [currentRows, previousRows, weekRows, rawReviews] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(period.startKey, period.endKey, [restaurantId]),
    fetchSupabaseCanonicalReputationMetrics(previousPeriod.startKey, previousPeriod.endKey, [restaurantId]),
    Promise.all(weeks.map((w) => fetchSupabaseCanonicalReputationMetrics(w.start, w.end, [restaurantId]))),
    loadReviews(restaurantId, period.startKey, period.endKey),
  ]);
  const current = currentRows[0];
  const previous = previousRows[0];
  if (!current || !previous) throw new Error("Faltan métricas oficiales del restaurante");
  const starCounts = [1, 2, 3, 4, 5].map((star) => rawReviews.filter((r) => Number(r.estrellas) === star).length);
  const official = [current.stars_1, current.stars_2, current.stars_3, current.stars_4, current.stars_5].map(n);
  if (rawReviews.length !== n(current.total_resenas) || starCounts.some((v, i) => v !== official[i])) {
    throw new Error("Las reseñas del registro no coinciden con los indicadores oficiales; no se generó un PDF incompleto");
  }

  const negatives = rawReviews.filter((r) => Number(r.estrellas) <= 2);
  const { rows: motives, error: motivesError } = await fetchResenaMotivosForReviewIds(
    negatives.map((r) => String(r.review_id ?? "")).filter(Boolean)
  );
  if (motivesError) throw new Error(`No se pudieron cargar los motivos: ${motivesError}`);
  const motiveById = new Map(motives.map((m) => [m.review_id, m.categoria]));
  const reasonCounts = new Map<string, number>();
  const reviews: MonthlyReview[] = rawReviews.map((r) => {
    const stars = Number(r.estrellas);
    const category = motiveById.get(String(r.review_id ?? ""));
    const reason = stars <= 2
      ? category ? categoriaMotivoLabel(category) : classifyReviewReason({ comentario: r.comentario })
      : null;
    if (reason) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    return {
      id: String(r.review_id ?? r.id), author: r.autor?.trim() || "Cliente anónimo",
      date: (r.fecha_resena ?? r.created_at ?? "").slice(0, 10),
      editedAt: r.editada && r.fecha_ultima_edicion ? activityKey(r) : null,
      stars, comment: r.comentario?.trim() || "Sin comentario", reason,
    };
  });
  const totalNegatives = n(current.negativas);
  return {
    restaurant: {
      id: restaurantId, name: row.restaurante, brand: row.marca, city: row.ciudad ?? "",
      address: row.direccion ?? "", company: row.empresa ?? "", target: n(row.objetivo_media) || 4.4,
      total: n(current.total_resenas), average: n(current.total_resenas) ? n(current.media_exacta) : null,
    },
    label: period.label, startKey: period.startKey, endKey: period.endKey,
    current, previous,
    weeks: weeks.map((week, i) => {
      const metric = weekRows[i]?.[0];
      const total = n(metric?.total_resenas);
      return { label: week.label, total, average: total ? n(metric?.media_exacta) : null,
        positive: n(metric?.positivas), neutral: n(metric?.neutras), negative: n(metric?.negativas) };
    }),
    reviews,
    reasons: [...reasonCounts].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({
      label, count, percent: totalNegatives ? count / totalNegatives * 100 : 0,
    })),
  };
}
