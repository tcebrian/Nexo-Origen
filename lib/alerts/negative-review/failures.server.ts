import "server-only";

import { qualifyRestaurantName } from "@/lib/restaurants/qualified-name";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { describeAlertFailure, type AlertFailureRow, type DescribedFailure } from "./failures";

/**
 * Lectura de los fallos de envío de alertas negativas (solo servidor, service role). Solo la usa la página
 * "Fallos de envío" de Conversations, que exige el mismo permiso que Conversations (super_admin).
 * Solo se leen identificadores, nombres, estrellas y códigos: nunca teléfonos ni el texto de la reseña.
 */

const ALERTAS = "conv_alertas_negativas";
/** Fallos más recientes que se muestran. */
export const FAILURES_LIMIT = 300;

export type AlertFailureView = AlertFailureRow & DescribedFailure;

type AlertRow = {
  id: string;
  resena_id: number;
  contacto_id: string;
  restaurante_id: number;
  origen: string;
  status: string;
  via: string | null;
  error_code: string | null;
  error_reason: string | null;
  created_at: string;
  delivered_at: string | null;
};

export async function listAlertFailures(): Promise<AlertFailureView[]> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");

  const { data, error } = await client
    .from(ALERTAS)
    .select("id,resena_id,contacto_id,restaurante_id,origen,status,via,error_code,error_reason,created_at,delivered_at")
    .or("error_code.not.is.null,error_reason.not.is.null,status.eq.failed")
    .order("created_at", { ascending: false })
    .limit(FAILURES_LIMIT);
  if (error) throw new Error(`alert-failures list failed (${error.code ?? "unknown"})`);
  const rows = (data ?? []) as AlertRow[];
  if (rows.length === 0) return [];

  const contactIds = [...new Set(rows.map((row) => row.contacto_id))];
  const restaurantIds = [...new Set(rows.map((row) => Number(row.restaurante_id)))];
  const reviewIds = [...new Set(rows.map((row) => Number(row.resena_id)))];

  const [contacts, restaurants, reviews] = await Promise.all([
    client.from(SUPABASE_TABLES.conv_contactos).select("id,nombre,nombre_perfil").in("id", contactIds),
    client.from(SUPABASE_TABLES.restaurantes).select("id,nombre,marca_id").in("id", restaurantIds),
    client.from("resenas").select("id,estrellas").in("id", reviewIds),
  ]);
  if (contacts.error || restaurants.error || reviews.error) throw new Error("alert-failures details failed");

  const brandIds = [
    ...new Set(
      ((restaurants.data ?? []) as { marca_id: number | null }[]).map((row) => row.marca_id).filter((id): id is number => id !== null)
    ),
  ];
  const brands = brandIds.length
    ? await client.from(SUPABASE_TABLES.marcas).select("id,nombre").in("id", brandIds)
    : { data: [], error: null };
  if (brands.error) throw new Error("alert-failures brands failed");

  const brandName = new Map(((brands.data ?? []) as { id: number; nombre: string }[]).map((row) => [Number(row.id), row.nombre]));
  const contactName = new Map(
    ((contacts.data ?? []) as { id: string; nombre: string | null; nombre_perfil: string | null }[]).map((row) => [
      row.id,
      row.nombre?.trim() || row.nombre_perfil?.trim() || "Contacto sin nombre",
    ])
  );
  const restaurantName = new Map(
    ((restaurants.data ?? []) as { id: number; nombre: string | null; marca_id: number | null }[]).map((row) => [
      Number(row.id),
      qualifyRestaurantName(row.marca_id === null ? "" : (brandName.get(Number(row.marca_id)) ?? ""), row.nombre?.trim() || "Restaurante"),
    ])
  );
  const stars = new Map(((reviews.data ?? []) as { id: number; estrellas: number | null }[]).map((row) => [Number(row.id), row.estrellas]));

  return rows.map((row) => {
    const base: AlertFailureRow = {
      id: row.id,
      resenaId: Number(row.resena_id),
      restaurantName: restaurantName.get(Number(row.restaurante_id)) ?? `Restaurante ${row.restaurante_id}`,
      stars: stars.get(Number(row.resena_id)) ?? null,
      contactName: contactName.get(row.contacto_id) ?? "Contacto eliminado",
      origin: row.origen === "prueba" ? "prueba" : "real",
      status: row.status,
      via: row.via,
      errorCode: row.error_code,
      errorReason: row.error_reason,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
    };
    return { ...base, ...describeAlertFailure(base) };
  });
}

/**
 * Fallos SIN RESOLVER (la alerta sigue sin llegar: `pending` o `failed` con motivo). Para el aviso de
 * Conversations. `null` si no se puede consultar: el aviso simplemente no se muestra.
 */
export async function countUnresolvedAlertFailures(): Promise<number | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { count, error } = await client
    .from(ALERTAS)
    .select("id", { count: "exact", head: true })
    .or("error_code.not.is.null,error_reason.not.is.null,status.eq.failed")
    .in("status", ["pending", "failed"]);
  return error ? null : (count ?? 0);
}
