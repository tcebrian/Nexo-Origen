import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import type {
  IntegrationStatus,
  IntegrationStatusSnapshot,
  RestaurantIntegrationStatusItem,
} from "@/lib/integrations/status-types";

type RestaurantRow = {
  id: number;
  nombre: string;
  ciudad: string | null;
};

type IntegrationRow = {
  restaurante_id: number;
  provider: string;
  status: IntegrationStatus;
  last_sync_at: string | null;
  last_error: string | null;
};

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

function integrationIssue(
  google: IntegrationRow | undefined,
  apify: IntegrationRow | undefined
): string | null {
  if (!google) return "Google Maps no está registrado.";
  if (google.status === "error") {
    return google.last_error || "Google Maps necesita revisión.";
  }
  if (google.status !== "connected" && google.status !== "syncing") {
    return "Google Maps está pendiente.";
  }

  if (!apify) return "Apify no está registrado.";
  if (apify.status === "error") {
    return apify.last_error || "Apify necesita revisión.";
  }
  if (apify.status === "pending") {
    return "Apify está pendiente de conexión.";
  }
  if (apify.status === "disabled") {
    return "Apify está desactivado.";
  }

  return null;
}

export async function getIntegrationStatusSnapshot(): Promise<IntegrationStatusSnapshot> {
  const client = requireAdminClient();

  const [restaurantsResult, integrationsResult, agentsResult, lastReviewResult] =
    await Promise.all([
      client
        .from(SUPABASE_TABLES.restaurantes)
        .select("id,nombre,ciudad")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      client
        .from(SUPABASE_TABLES.restaurante_integraciones)
        .select("restaurante_id,provider,status,last_sync_at,last_error"),
      client
        .from(SUPABASE_TABLES.nexo_bot_accesos)
        .select("activo,modo"),
      client
        .from(SUPABASE_TABLES.resenas)
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (restaurantsResult.error) throw restaurantsResult.error;
  if (integrationsResult.error) throw integrationsResult.error;
  if (agentsResult.error) throw agentsResult.error;
  if (lastReviewResult.error) throw lastReviewResult.error;

  const restaurants = (restaurantsResult.data ?? []) as RestaurantRow[];
  const integrations = (integrationsResult.data ?? []) as IntegrationRow[];

  const integrationByRestaurant = new Map<
    number,
    Map<string, IntegrationRow>
  >();

  for (const row of integrations) {
    const byProvider =
      integrationByRestaurant.get(Number(row.restaurante_id)) ??
      new Map<string, IntegrationRow>();
    byProvider.set(row.provider, row);
    integrationByRestaurant.set(Number(row.restaurante_id), byProvider);
  }

  const items: RestaurantIntegrationStatusItem[] = restaurants.map((restaurant) => {
    const byProvider = integrationByRestaurant.get(Number(restaurant.id));
    const google = byProvider?.get("google_maps");
    const apify = byProvider?.get("apify");

    return {
      restaurantId: Number(restaurant.id),
      restaurantName: String(restaurant.nombre),
      city: restaurant.ciudad ? String(restaurant.ciudad) : null,
      googleMaps: google?.status ?? "missing",
      apify: apify?.status ?? "missing",
      lastApifyDataAt: apify?.last_sync_at ?? null,
      issue: integrationIssue(google, apify),
    };
  });

  const activeAgents = (agentsResult.data ?? []).filter((row) => row.activo).length;
  const pilotAgents = (agentsResult.data ?? []).filter(
    (row) => row.activo && row.modo === "piloto"
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    activeRestaurants: items.length,
    googleConnected: items.filter((item) => item.googleMaps === "connected").length,
    googlePending: items.filter(
      (item) =>
        item.googleMaps !== "connected" &&
        item.googleMaps !== "syncing"
    ).length,
    apifyConnected: items.filter((item) => item.apify === "connected").length,
    apifyPending: items.filter(
      (item) => item.apify === "pending" || item.apify === "missing"
    ).length,
    apifyErrors: items.filter((item) => item.apify === "error").length,
    activeAgents,
    pilotAgents,
    lastReviewIngestionAt: lastReviewResult.data?.created_at ?? null,
    restaurants: items.sort((a, b) => {
      const issueDiff = Number(Boolean(b.issue)) - Number(Boolean(a.issue));
      if (issueDiff !== 0) return issueDiff;
      return a.restaurantName.localeCompare(b.restaurantName, "es");
    }),
  };
}
