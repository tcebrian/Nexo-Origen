import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { dedupeResenas, classifyMediaStatus } from "@/lib/review-metrics";
import { toDateKey } from "@/lib/dates/period";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AgentDailySummaryPreview } from "@/lib/agents/types";

type AccessRow = {
  id: string;
  nombre: string;
  todos_restaurantes: boolean;
  restaurante_ids: Array<number | string>;
};

type RestaurantRow = {
  id: number;
  nombre: string;
  ciudad: string | null;
};

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

function addDays(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayOf(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, offset);
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function statusLabel(media: number, hasReviews: boolean): string {
  const status = classifyMediaStatus(media, hasReviews).operationalStatus;
  if (status === "on_target") return "En objetivo";
  if (status === "watch") return "Seguimiento";
  return "Crítico";
}

function normalizeIds(values: Array<number | string>): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

export async function buildAgentDailySummaryPreview(
  agentId: string
): Promise<AgentDailySummaryPreview> {
  const client = requireAdminClient();

  const { data: access, error: accessError } = await client
    .from(SUPABASE_TABLES.nexo_bot_accesos)
    .select("id,nombre,todos_restaurantes,restaurante_ids")
    .eq("id", agentId)
    .maybeSingle();

  if (accessError) throw accessError;
  if (!access) throw new Error("Agente no encontrado.");

  const accessRow = access as AccessRow;

  let restaurantQuery = client
    .from(SUPABASE_TABLES.restaurantes)
    .select("id,nombre,ciudad")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const allowedIds = normalizeIds(accessRow.restaurante_ids ?? []);
  if (!accessRow.todos_restaurantes) {
    if (allowedIds.length === 0) {
      throw new Error("El agente no tiene restaurantes asignados.");
    }
    restaurantQuery = restaurantQuery.in("id", allowedIds);
  }

  const { data: restaurantData, error: restaurantError } = await restaurantQuery;
  if (restaurantError) throw restaurantError;

  const restaurants = (restaurantData ?? []).map(
    (row): RestaurantRow => ({
      id: Number(row.id),
      nombre: String(row.nombre ?? "Restaurante"),
      ciudad: row.ciudad ? String(row.ciudad) : null,
    })
  );

  if (restaurants.length === 0) {
    throw new Error("No hay restaurantes activos para este agente.");
  }

  const todayKey = toDateKey(new Date());
  const weekStartKey = mondayOf(todayKey);
  const yesterdayKey = addDays(todayKey, -1);
  const tomorrowKey = addDays(todayKey, 1);
  const restaurantIds = restaurants.map((restaurant) => restaurant.id);

  const { data: reviewData, error: reviewError } = await client
    .from(SUPABASE_TABLES.resenas)
    .select(
      "id,review_id,restaurante_id,estrellas,comentario,autor,fecha_resena,created_at,editada,fecha_ultima_edicion"
    )
    .in("restaurante_id", restaurantIds)
    .gte("fecha_resena", `${weekStartKey}T00:00:00`)
    .lt("fecha_resena", `${tomorrowKey}T00:00:00`)
    .order("fecha_resena", { ascending: true });

  if (reviewError) throw reviewError;

  const reviews = dedupeResenas((reviewData ?? []) as ResenaRow[]);
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

  const byRestaurant = new Map<
    number,
    { total: number; sum: number; attention: number; yesterday: number }
  >();

  for (const restaurant of restaurants) {
    byRestaurant.set(restaurant.id, { total: 0, sum: 0, attention: 0, yesterday: 0 });
  }

  let yesterdayTotal = 0;
  let yesterdayAttention = 0;

  for (const review of reviews) {
    const restaurantId = Number(review.restaurante_id);
    const current = byRestaurant.get(restaurantId);
    if (!current) continue;

    current.total += 1;
    current.sum += Number(review.estrellas) || 0;
    if (review.estrellas <= 3) current.attention += 1;

    const reviewDateKey = toDateKey(review.fecha_resena ?? review.created_at ?? "");
    if (reviewDateKey === yesterdayKey) {
      current.yesterday += 1;
      yesterdayTotal += 1;
      if (review.estrellas <= 3) yesterdayAttention += 1;
    }
  }

  const rows = restaurants
    .map((restaurant) => {
      const stats = byRestaurant.get(restaurant.id)!;
      const media = stats.total > 0 ? stats.sum / stats.total : 0;
      const operational = classifyMediaStatus(media, stats.total > 0).operationalStatus;

      return {
        ...restaurant,
        ...stats,
        media,
        operational,
      };
    })
    .sort((a, b) => {
      const statusOrder = { critical: 0, watch: 1, on_target: 2 } as const;
      const diff = statusOrder[a.operational] - statusOrder[b.operational];
      if (diff !== 0) return diff;
      if (a.total === 0 && b.total > 0) return 1;
      if (b.total === 0 && a.total > 0) return -1;
      return a.media - b.media;
    });

  const visibleRows =
    rows.length <= 10
      ? rows
      : rows
          .filter((row) => row.operational !== "on_target" || row.attention > 0)
          .slice(0, 10);

  const lines: string[] = [
    "NEXO · Resumen diario",
    `Supervisor: ${accessRow.nombre}`,
    `Semana: ${formatDate(weekStartKey)} – ${formatDate(todayKey)}`,
    "",
    `Ayer: ${yesterdayTotal} reseñas nuevas · ${yesterdayAttention} requieren atención (1–3★)`,
    "",
    "Esta semana:",
  ];

  for (const row of visibleRows) {
    const location = row.ciudad ? ` · ${row.ciudad}` : "";
    if (row.total === 0) {
      lines.push(`- ${row.nombre}${location}: sin reseñas esta semana`);
      continue;
    }

    lines.push(
      `- ${row.nombre}${location}: ${row.media.toFixed(2)} · ${row.total} reseñas · ${row.attention} atención · ${statusLabel(row.media, true)}`
    );
  }

  if (rows.length > visibleRows.length) {
    lines.push(`- +${rows.length - visibleRows.length} restaurantes sin incidencias destacadas`);
  }

  const attentionRows = rows.filter(
    (row) => row.total > 0 && (row.operational !== "on_target" || row.attention > 0)
  );

  if (attentionRows.length > 0) {
    lines.push("", "Puntos a revisar:");
    for (const row of attentionRows.slice(0, 5)) {
      lines.push(
        `- ${row.nombre}: media ${row.media.toFixed(2)} y ${row.attention} reseñas de 1–3★ esta semana.`
      );
    }
  } else {
    lines.push("", "Sin puntos críticos detectados en los restaurantes asignados.");
  }

  return {
    agentId,
    generatedAt: new Date().toISOString(),
    dateKey: todayKey,
    message: lines.join("\n"),
  };
}
