import "server-only";

import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import {
  getInclusiveQueryBoundsFromDates,
  isTimestampInQueryRange,
  type QueryDateBounds,
} from "@/lib/date-utils";
import { dedupeResenas } from "@/lib/review-metrics";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import type { PeriodQuery } from "./kpi-restaurantes";
import type { ResenaRow } from "./resenas";

const DATE_FILTER_COLUMNS = ["fecha_resena", "created_at"] as const;

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function normalizeResena(row: Record<string, unknown>): ResenaRow {
  const restauranteNombre =
    pickString(row, "restaurante_nombre", "restaurante", "nombre_restaurante", "name") ?? null;

  return {
    id: row.id as number | string,
    review_id: row.review_id != null ? (row.review_id as number | string) : null,
    restaurante_id: row.restaurante_id != null ? toNumber(row.restaurante_id) : null,
    estrellas: toNumber(row.estrellas ?? row.rating ?? row.stars),
    created_at: row.created_at ? String(row.created_at) : null,
    comentario: pickString(row, "comentario", "texto", "text", "review_text"),
    autor: pickString(row, "autor", "author", "nombre_autor"),
    fecha_resena: pickString(row, "fecha_resena", "fecha", "review_date") ?? (row.created_at ? String(row.created_at) : null),
    restaurante_nombre: restauranteNombre,
    restaurante: restauranteNombre,
    marca: pickString(row, "marca", "brand"),
    direccion: pickString(row, "direccion", "address"),
    empleado_nombre: pickString(row, "empleado_nombre", "empleado", "nombre_empleado"),
    empleado: pickString(row, "empleado"),
    nombre_empleado: pickString(row, "nombre_empleado"),
  };
}

function filterResenaRows(
  rows: ResenaRow[],
  queryBounds: QueryDateBounds,
  options?: { restaurantSlug?: string; restauranteId?: number }
): ResenaRow[] {
  let filtered = rows.filter((row) =>
    isTimestampInQueryRange(row.fecha_resena ?? row.created_at, queryBounds)
  );

  if (options?.restauranteId != null) {
    filtered = filtered.filter((row) => row.restaurante_id === options.restauranteId);
  }

  if (options?.restaurantSlug) {
    filtered = filtered.filter((row) => {
      if (!row.restaurante) return false;
      return restaurantSlug(row.restaurante) === options.restaurantSlug;
    });
  }

  return dedupeResenas(filtered);
}

async function fetchResenasWithDateColumn(
  client: Awaited<ReturnType<typeof getSupabaseDataClientForServer>>,
  dateColumn: string,
  queryBounds: QueryDateBounds,
  options?: {
    restaurantSlug?: string;
    restauranteId?: number;
    restauranteNombreIlike?: string;
  }
): Promise<{ rows: ResenaRow[]; columnMissing: boolean }> {
  let builder = client
    .from("resenas")
    .select("*")
    .gte(dateColumn, queryBounds.startIso)
    .lt(dateColumn, queryBounds.endExclusiveIso)
    .order(dateColumn, { ascending: false });

  if (options?.restauranteId != null) {
    builder = builder.eq("restaurante_id", options.restauranteId);
  }

  const brandFilter = options?.restauranteNombreIlike?.trim();
  if (brandFilter) {
    builder = builder.ilike("restaurante_nombre", `%${brandFilter}%`);
  }

  const { data, error } = await builder;

  if (error) {
    if (error.code === "42703") {
      return { rows: [], columnMissing: true };
    }
    console.error(`[fetchResenasForPeriodServer] Error (${dateColumn}):`, error.message, error);
    return { rows: [], columnMissing: false };
  }

  const rows = (data ?? []).map((row) => normalizeResena(row as Record<string, unknown>));
  return { rows, columnMissing: false };
}

async function queryResenasForPeriod(
  client: Awaited<ReturnType<typeof getSupabaseDataClientForServer>>,
  queryBounds: QueryDateBounds,
  options?: {
    restaurantSlug?: string;
    restauranteId?: number;
    restauranteNombreIlike?: string;
  }
): Promise<ResenaRow[]> {
  let bestRows: ResenaRow[] = [];

  for (const dateColumn of DATE_FILTER_COLUMNS) {
    const { rows, columnMissing } = await fetchResenasWithDateColumn(
      client,
      dateColumn,
      queryBounds,
      options
    );

    if (columnMissing) continue;

    const filtered = filterResenaRows(rows, queryBounds, options);
    if (filtered.length > bestRows.length) {
      bestRows = filtered;
    }
    if (filtered.length > 0) {
      return filtered;
    }
  }

  if (bestRows.length > 0) {
    return bestRows;
  }

  console.warn(
    `[fetchResenasForPeriodServer] 0 reseñas entre ${queryBounds.startKey} y ${queryBounds.endKey}. ` +
      "Prueba ampliar el rango de fechas en el calendario del dashboard."
  );
  return [];
}

/** Lectura en servidor con service role / RLS. */
export async function fetchResenasForPeriodServer(
  query: PeriodQuery,
  options?: {
    restaurantSlug?: string;
    restauranteId?: number;
    restauranteNombreIlike?: string;
    queryBounds?: QueryDateBounds;
  }
): Promise<ResenaRow[]> {
  const queryBounds =
    options?.queryBounds ?? getInclusiveQueryBoundsFromDates(query.start, query.end);
  const client = await getSupabaseDataClientForServer();
  return queryResenasForPeriod(client, queryBounds, options);
}

/** Resuelve restaurante_id de una reseña por review_id (sin filtro de periodo). */
export async function fetchResenaRestauranteIdByReviewId(
  reviewId: string
): Promise<number | null> {
  const client = await getSupabaseDataClientForServer();
  const trimmed = reviewId.trim();
  if (!client || !trimmed) return null;

  async function lookup(column: string, value: string | number): Promise<number | null> {
    const { data, error } = await client
      .from(SUPABASE_TABLES.resenas)
      .select("restaurante_id")
      .eq(column, value)
      .maybeSingle();

    if (error || !data) return null;
    const id = Number((data as { restaurante_id: unknown }).restaurante_id);
    return Number.isFinite(id) ? id : null;
  }

  const byReviewId = await lookup("review_id", trimmed);
  if (byReviewId != null) return byReviewId;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    const byNumeric = await lookup("review_id", numeric);
    if (byNumeric != null) return byNumeric;
  }

  return lookup("id", trimmed);
}
