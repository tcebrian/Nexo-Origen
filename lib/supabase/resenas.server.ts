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
import { getResenaActivityDateValue, type ResenaRow } from "./resenas";

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
    editada: row.editada === true,
    fecha_ultima_edicion: row.fecha_ultima_edicion ? String(row.fecha_ultima_edicion) : null,
    restaurante_nombre: restauranteNombre,
    restaurante: restauranteNombre,
    marca: pickString(row, "marca", "brand"),
    direccion: pickString(row, "direccion", "address"),
    empleado_nombre: pickString(row, "empleado_nombre", "empleado", "nombre_empleado"),
    empleado: pickString(row, "empleado"),
    nombre_empleado: pickString(row, "nombre_empleado"),
  };
}

/**
 * Una reseña pertenece a UN único periodo — el de su fecha de actividad
 * (getResenaActivityDateValue: la última edición si fue editada, si no la
 * fecha original) — nunca a dos a la vez. Antes se usaba un OR entre fecha
 * original y fecha de edición, así que una reseña editada de una semana
 * para otra aparecía en los informes de ambas semanas, contando doble
 * (comprobado con datos reales: 11 de las 13 reseñas editadas caen en una
 * semana distinta a la que se editaron). `fecha_resena` no se toca ni se
 * pierde en ningún momento — sigue disponible tal cual para mostrarla,
 * esto solo decide en qué periodo se cuenta la reseña.
 */
function isResenaInPeriod(row: ResenaRow, queryBounds: QueryDateBounds): boolean {
  const activityDate = getResenaActivityDateValue(row);
  return isTimestampInQueryRange(activityDate, queryBounds);
}

function filterResenaRows(
  rows: ResenaRow[],
  queryBounds: QueryDateBounds,
  options?: { restaurantSlug?: string; restauranteId?: number }
): ResenaRow[] {
  let filtered = rows.filter((row) => isResenaInPeriod(row, queryBounds));

  if (options?.restauranteId != null) {
    filtered = filtered.filter((row) => row.restaurante_id === options.restauranteId);
  }

  if (options?.restaurantSlug) {
    filtered = filtered.filter((row) => {
      if (!row.restaurante) return false;
      return restaurantSlug(row.restaurante) === options.restaurantSlug;
    });
  }

  // Cada fila física cuenta una sola vez aunque cumpla la condición de fecha
  // por partida doble (creada Y editada dentro del mismo periodo) — el OR de
  // Supabase ya devuelve cada fila una vez, esto es solo la red de seguridad
  // habitual por review_id/contenido.
  return dedupeResenas(filtered);
}

/**
 * Trae reseñas cuya fecha_resena (o created_at si fecha_resena es null) O
 * fecha_ultima_edicion caigan en el rango — un único query con OR a nivel de
 * SQL, así cada fila se devuelve como máximo una vez (sin duplicados).
 */
async function fetchResenasInPeriod(
  client: Awaited<ReturnType<typeof getSupabaseDataClientForServer>>,
  queryBounds: QueryDateBounds,
  options?: {
    restaurantSlug?: string;
    restauranteId?: number;
    restauranteNombreIlike?: string;
  }
): Promise<{ rows: ResenaRow[]; error: boolean }> {
  const { startIso, endExclusiveIso } = queryBounds;
  const inRange = (column: string) => `${column}.gte.${startIso},${column}.lt.${endExclusiveIso}`;
  const orFilter = [
    `and(${inRange("fecha_resena")})`,
    `and(${inRange("fecha_ultima_edicion")})`,
    `and(fecha_resena.is.null,${inRange("created_at")})`,
  ].join(",");

  let builder = client.from("resenas").select("*").or(orFilter);

  if (options?.restauranteId != null) {
    builder = builder.eq("restaurante_id", options.restauranteId);
  }

  const brandFilter = options?.restauranteNombreIlike?.trim();
  if (brandFilter) {
    builder = builder.ilike("restaurante_nombre", `%${brandFilter}%`);
  }

  const { data, error } = await builder;

  if (error) {
    console.error("[fetchResenasForPeriodServer] Error:", error.message, error);
    return { rows: [], error: true };
  }

  const rows = (data ?? []).map((row) => normalizeResena(row as Record<string, unknown>));
  return { rows, error: false };
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
  const { rows, error } = await fetchResenasInPeriod(client, queryBounds, options);
  if (error) return [];

  const filtered = filterResenaRows(rows, queryBounds, options);
  if (filtered.length === 0) {
    console.warn(
      `[fetchResenasForPeriodServer] 0 reseñas entre ${queryBounds.startKey} y ${queryBounds.endKey}. ` +
        "Prueba ampliar el rango de fechas en el calendario del dashboard."
    );
  }
  return filtered;
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

/**
 * Resultado de demostrar `review_id → reseña real → restaurante`. Cualquier cosa distinta de `ok` significa que NO
 * se puede demostrar y quien llame debe denegar (nunca tratarlo como "sin restricción").
 */
export type ReviewRestaurantResolution =
  | { ok: true; restauranteId: number }
  | { ok: false; reason: "not_found" | "no_restaurant" | "ambiguous" | "db_error" };

type ResenaLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        limit: (count: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

/**
 * Resuelve de forma INEQUÍVOCA el restaurante de una reseña por su `review_id` (coincidencia exacta, sin
 * variantes numéricas ni alternativas por `id`: el frontend siempre envía `resenas.review_id`).
 *  - 0 filas → `not_found`; error de base de datos → `db_error`.
 *  - más de una fila (review_id duplicado) → `ambiguous`: no se elige ninguna.
 *  - `restaurante_id` nulo o no válido → `no_restaurant`.
 */
export async function resolveReviewRestaurant(
  reviewId: string,
  client?: ResenaLookupClient
): Promise<ReviewRestaurantResolution> {
  const id = reviewId.trim();
  if (!id) return { ok: false, reason: "not_found" };

  let rows: unknown[] | null;
  try {
    const db = client ?? ((await getSupabaseDataClientForServer()) as unknown as ResenaLookupClient);
    const { data, error } = await db.from(SUPABASE_TABLES.resenas).select("id,restaurante_id").eq("review_id", id).limit(2);
    if (error) return { ok: false, reason: "db_error" };
    rows = data;
  } catch {
    return { ok: false, reason: "db_error" };
  }

  if (!rows || rows.length === 0) return { ok: false, reason: "not_found" };
  if (rows.length > 1) return { ok: false, reason: "ambiguous" };

  const restaurante = (rows[0] as { restaurante_id?: unknown }).restaurante_id;
  const restauranteId = restaurante === null || restaurante === undefined || restaurante === "" ? NaN : Number(restaurante);
  if (!Number.isSafeInteger(restauranteId) || restauranteId <= 0) return { ok: false, reason: "no_restaurant" };
  return { ok: true, restauranteId };
}
