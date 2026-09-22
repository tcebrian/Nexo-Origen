import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { toDateKey } from "@/lib/dates/period";
import {
  fetchSupabaseCanonicalReputationMetrics,
  type SupabaseMetricRow,
} from "@/lib/supabase/reputation-metrics.server";
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

function formatLongDate(dateKey: string): string {
  const value = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${dateKey}T12:00:00Z`));

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dateParts(dateKey: string): { day: number; month: string; year: number } {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = Number(
    new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      timeZone: "Europe/Madrid",
    }).format(date)
  );
  const month = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(date);
  const year = Number(
    new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      timeZone: "Europe/Madrid",
    }).format(date)
  );

  return { day, month, year };
}

function formatWeeklyPeriod(startKey: string, endKey: string): string {
  const start = dateParts(startKey);
  const end = dateParts(endKey);

  if (start.year === end.year && start.month === end.month) {
    return `${start.day} al ${end.day} de ${end.month} de ${end.year}`;
  }

  if (start.year === end.year) {
    return `${start.day} de ${start.month} al ${end.day} de ${end.month} de ${end.year}`;
  }

  return `${start.day} de ${start.month} de ${start.year} al ${end.day} de ${end.month} de ${end.year}`;
}

function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

type OperationalStatus = "on_target" | "watch" | "critical";

function statusLabel(status: OperationalStatus): string {
  if (status === "on_target") return "En objetivo";
  if (status === "watch") return "Seguimiento";
  return "Crítico";
}

function normalizeStatus(value: string | null | undefined): OperationalStatus {
  if (value === "on_target" || value === "critical") return value;
  return "watch";
}

function metricNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const weekEndKey = addDays(weekStartKey, 6);
  const yesterdayKey = addDays(todayKey, -1);
  const restaurantIds = restaurants.map((restaurant) => restaurant.id);

  // All deterministic numbers come directly from the canonical Supabase SQL
  // function. Vercel only formats the already-calculated result.
  const [weekMetricRows, yesterdayMetricRows] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(
      weekStartKey,
      todayKey,
      restaurantIds
    ),
    fetchSupabaseCanonicalReputationMetrics(
      yesterdayKey,
      yesterdayKey,
      restaurantIds
    ),
  ]);

  const weekByRestaurant = new Map<number, SupabaseMetricRow>(
    weekMetricRows.map((row) => [metricNumber(row.restaurante_id), row])
  );

  const weekNetwork = weekMetricRows[0] ?? null;
  const yesterdayNetwork = yesterdayMetricRows[0] ?? null;

  const totalWeeklyReviews = metricNumber(weekNetwork?.network_total_resenas);
  const weeklyMedia = metricNumber(weekNetwork?.network_media_exacta);
  const yesterdayTotal = metricNumber(
    yesterdayNetwork?.network_total_resenas
  );
  const yesterdayAttention = metricNumber(
    yesterdayNetwork?.network_atencion
  );

  const rows = restaurants
    .map((restaurant) => {
      const metrics = weekByRestaurant.get(restaurant.id);
      return {
        ...restaurant,
        total: metricNumber(metrics?.total_resenas),
        media: metricNumber(metrics?.media_exacta),
        attention: metricNumber(metrics?.atencion),
        operational: normalizeStatus(metrics?.operational_status),
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

  const rowsWithReviews = rows.filter((row) => row.total > 0);
  const onTargetCount = rowsWithReviews.filter(
    (row) => row.operational === "on_target"
  ).length;
  const watchCount = rowsWithReviews.filter(
    (row) => row.operational === "watch"
  ).length;
  const criticalCount = rowsWithReviews.filter(
    (row) => row.operational === "critical"
  ).length;

  const lines: string[] = [
    "🤖 NEXO · Resumen diario",
    `👤 Supervisor: ${accessRow.nombre}`,
    `📅 Hoy: ${formatLongDate(todayKey)}`,
    `🗓️ Periodo semanal: ${formatWeeklyPeriod(weekStartKey, weekEndKey)}`,
    "",
    `📥 Ayer (${formatShortDate(yesterdayKey)}): ${yesterdayTotal} reseñas nuevas · ${yesterdayAttention} requieren atención (1–3★)`,
    "",
    "📊 Esta semana:",
  ];

  for (const row of visibleRows) {
    const location = row.ciudad ? ` · ${row.ciudad}` : "";
    if (row.total === 0) {
      lines.push(`⚪ ${row.nombre}${location}: sin reseñas esta semana`);
      continue;
    }

    const statusEmoji =
      row.operational === "on_target"
        ? "🟢"
        : row.operational === "watch"
          ? "🟡"
          : "🔴";

    lines.push(
      `${statusEmoji} ${row.nombre}${location}: ${row.media.toFixed(2)} · ${row.total} reseñas · ${row.attention} atención · ${statusLabel(row.operational)}`
    );
  }

  if (rows.length > visibleRows.length) {
    lines.push(`➕ +${rows.length - visibleRows.length} restaurantes sin incidencias destacadas`);
  }

  const attentionRows = rows.filter(
    (row) => row.total > 0 && (row.operational !== "on_target" || row.attention > 0)
  );

  if (attentionRows.length > 0) {
    lines.push("", "⚠️ Puntos a revisar:");
    for (const row of attentionRows.slice(0, 5)) {
      lines.push(
        `• ${row.nombre}: media ${row.media.toFixed(2)} y ${row.attention} reseñas de 1–3★ esta semana.`
      );
    }
  } else {
    lines.push("", "✅ Sin puntos críticos detectados en los restaurantes con actividad.");
  }

  lines.push("");

  if (totalWeeklyReviews === 0) {
    lines.push(
      `📌 Dato clave: todavía no hay reseñas registradas esta semana en los ${rows.length} restaurantes asignados.`
    );
  } else if (criticalCount > 0) {
    const weakest = rowsWithReviews
      .filter((row) => row.operational === "critical")
      .sort((a, b) => a.media - b.media)[0];

    lines.push(
      `📌 Dato clave: ${criticalCount} de ${rowsWithReviews.length} locales con reseñas están en crítico. El más bajo es ${weakest.nombre} con ${weakest.media.toFixed(2)}.`
    );
  } else if (watchCount > 0) {
    const weakest = rowsWithReviews
      .filter((row) => row.operational === "watch")
      .sort((a, b) => a.media - b.media)[0];

    lines.push(
      `📌 Dato clave: media semanal ponderada ${weeklyMedia.toFixed(2)} con ${totalWeeklyReviews} reseñas. ${watchCount} local${watchCount === 1 ? "" : "es"} está${watchCount === 1 ? "" : "n"} en seguimiento; el más bajo es ${weakest.nombre} con ${weakest.media.toFixed(2)}.`
    );
  } else {
    lines.push(
      `📌 Dato clave: media semanal ponderada ${weeklyMedia.toFixed(2)} con ${totalWeeklyReviews} reseñas. ${onTargetCount} de ${rowsWithReviews.length} locales con actividad están en objetivo.`
    );
  }

  return {
    agentId,
    generatedAt: new Date().toISOString(),
    dateKey: todayKey,
    message: lines.join("\n"),
  };
}
