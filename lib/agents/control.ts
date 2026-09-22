import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

export type AgentMode = "piloto" | "activo" | "pausado";

export type AgentRestaurant = {
  id: number;
  nombre: string;
  ciudad: string | null;
};

export type AgentControlItem = {
  id: string;
  nombre: string;
  todosRestaurantes: boolean;
  restauranteIds: number[];
  restaurantes: AgentRestaurant[];
  activo: boolean;
  alertas: boolean;
  modo: AgentMode;
  resumenDiario: boolean;
  resumenHora: string;
  timezone: string;
  actualizadoEn: string | null;
  conversationCount: number;
  lastActivity: string | null;
  lastConversationState: string | null;
};

export type AgentControlSnapshot = {
  agents: AgentControlItem[];
  restaurants: AgentRestaurant[];
};

export type AgentControlUpdateInput = {
  id: string;
  todosRestaurantes: boolean;
  restauranteIds: number[];
  activo: boolean;
  alertas: boolean;
  modo: AgentMode;
  resumenDiario: boolean;
  resumenHora: string;
  timezone: string;
};

type AccessRow = {
  id: string;
  telefono: string;
  nombre: string;
  todos_restaurantes: boolean;
  restaurante_ids: Array<number | string>;
  activo: boolean;
  alertas: boolean;
  modo: AgentMode;
  resumen_diario: boolean;
  resumen_hora: string;
  timezone: string;
  actualizado_en: string | null;
};

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

function normalizeTime(value: string | null | undefined): string {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "09:00";
}

function normalizeRestaurantIds(values: Array<number | string> | null | undefined): number[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

export async function getAgentControlSnapshot(): Promise<AgentControlSnapshot> {
  const client = requireAdminClient();

  const [accessResult, restaurantsResult] = await Promise.all([
    client
      .from(SUPABASE_TABLES.nexo_bot_accesos)
      .select(
        "id,telefono,nombre,todos_restaurantes,restaurante_ids,activo,alertas,modo,resumen_diario,resumen_hora,timezone,actualizado_en"
      )
      .order("nombre", { ascending: true }),
    client
      .from(SUPABASE_TABLES.restaurantes)
      .select("id,nombre,ciudad")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
  ]);

  if (accessResult.error) throw accessResult.error;
  if (restaurantsResult.error) throw restaurantsResult.error;

  const restaurants = (restaurantsResult.data ?? []).map((row) => ({
    id: Number(row.id),
    nombre: String(row.nombre ?? "Restaurante"),
    ciudad: row.ciudad ? String(row.ciudad) : null,
  }));

  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const accessRows = (accessResult.data ?? []) as AccessRow[];

  const agents = await Promise.all(
    accessRows.map(async (row): Promise<AgentControlItem> => {
      const [{ count }, lastResult] = await Promise.all([
        client
          .from(SUPABASE_TABLES.nexo_bot_conversaciones)
          .select("id", { count: "exact", head: true })
          .eq("telefono", row.telefono),
        client
          .from(SUPABASE_TABLES.nexo_bot_conversaciones)
          .select("recibido_en,estado")
          .eq("telefono", row.telefono)
          .order("recibido_en", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const restauranteIds = normalizeRestaurantIds(row.restaurante_ids);
      const assignedRestaurants = row.todos_restaurantes
        ? restaurants
        : restauranteIds
            .map((id) => restaurantById.get(id))
            .filter((restaurant): restaurant is AgentRestaurant => Boolean(restaurant));

      return {
        id: row.id,
        nombre: row.nombre,
        todosRestaurantes: row.todos_restaurantes,
        restauranteIds,
        restaurantes: assignedRestaurants,
        activo: row.activo,
        alertas: row.alertas,
        modo: row.modo,
        resumenDiario: row.resumen_diario,
        resumenHora: normalizeTime(row.resumen_hora),
        timezone: row.timezone || "Europe/Madrid",
        actualizadoEn: row.actualizado_en,
        conversationCount: count ?? 0,
        lastActivity: lastResult.data?.recibido_en ?? null,
        lastConversationState: lastResult.data?.estado ?? null,
      };
    })
  );

  return { agents, restaurants };
}

function assertAgentMode(value: unknown): asserts value is AgentMode {
  if (value !== "piloto" && value !== "activo" && value !== "pausado") {
    throw new Error("Modo de agente no válido.");
  }
}

function assertClockTime(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Hora de resumen no válida.");
  }
}

export async function updateAgentControl(input: AgentControlUpdateInput): Promise<void> {
  const client = requireAdminClient();

  if (!input.id || typeof input.id !== "string") {
    throw new Error("Agente no válido.");
  }
  assertAgentMode(input.modo);
  assertClockTime(input.resumenHora);

  const restauranteIds = normalizeRestaurantIds(input.restauranteIds);

  if (!input.todosRestaurantes && restauranteIds.length === 0) {
    throw new Error("Selecciona al menos un restaurante o activa todos los restaurantes.");
  }

  if (!input.todosRestaurantes) {
    const { data, error } = await client
      .from(SUPABASE_TABLES.restaurantes)
      .select("id")
      .in("id", restauranteIds);

    if (error) throw error;
    if ((data ?? []).length !== restauranteIds.length) {
      throw new Error("Hay restaurantes seleccionados que no existen.");
    }
  }

  const { error } = await client
    .from(SUPABASE_TABLES.nexo_bot_accesos)
    .update({
      todos_restaurantes: input.todosRestaurantes,
      restaurante_ids: input.todosRestaurantes ? [] : restauranteIds,
      activo: Boolean(input.activo),
      alertas: Boolean(input.alertas),
      modo: input.modo,
      resumen_diario: Boolean(input.resumenDiario),
      resumen_hora: `${input.resumenHora}:00`,
      timezone: input.timezone || "Europe/Madrid",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) throw error;
}
