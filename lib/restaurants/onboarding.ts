import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import type {
  RestaurantOnboardingInput,
  RestaurantOnboardingOptions,
  RestaurantOnboardingResult,
} from "@/lib/restaurants/onboarding-types";

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

function requiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

function optionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function getRestaurantOnboardingOptions(): Promise<RestaurantOnboardingOptions> {
  const client = requireAdminClient();

  const [brands, companies] = await Promise.all([
    client.from(SUPABASE_TABLES.marcas).select("id,nombre").order("nombre"),
    client.from(SUPABASE_TABLES.empresas).select("id,nombre").order("nombre"),
  ]);

  if (brands.error) throw brands.error;
  if (companies.error) throw companies.error;

  return {
    marcas: (brands.data ?? []).map((row) => ({
      id: Number(row.id),
      nombre: String(row.nombre),
    })),
    empresas: (companies.data ?? []).map((row) => ({
      id: Number(row.id),
      nombre: String(row.nombre),
    })),
  };
}

export async function createRestaurantFromNexo(
  input: RestaurantOnboardingInput
): Promise<RestaurantOnboardingResult> {
  const client = requireAdminClient();

  const nombre = requiredText(input.nombre, "El nombre");
  const placeId = requiredText(input.placeId, "El Place ID");
  const marcaId = Number(input.marcaId);
  const empresaId = Number(input.empresaId);

  if (!Number.isInteger(marcaId) || marcaId <= 0) {
    throw new Error("Selecciona una marca válida.");
  }
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error("Selecciona una empresa válida.");
  }

  const [{ data: brand }, { data: company }, { data: existing }] = await Promise.all([
    client.from(SUPABASE_TABLES.marcas).select("id").eq("id", marcaId).maybeSingle(),
    client.from(SUPABASE_TABLES.empresas).select("id").eq("id", empresaId).maybeSingle(),
    client.from(SUPABASE_TABLES.restaurantes).select("id,nombre").eq("place_id", placeId).maybeSingle(),
  ]);

  if (!brand) throw new Error("La marca seleccionada no existe.");
  if (!company) throw new Error("La empresa seleccionada no existe.");
  if (existing) {
    throw new Error(`Ese Place ID ya pertenece a ${existing.nombre ?? "otro restaurante"}.`);
  }

  const { data: restaurant, error: restaurantError } = await client
    .from(SUPABASE_TABLES.restaurantes)
    .insert({
      nombre,
      direccion: optionalText(input.direccion),
      ciudad: optionalText(input.ciudad),
      marca_id: marcaId,
      empresa_id: empresaId,
      place_id: placeId,
      activo: true,
    })
    .select("id,nombre")
    .single();

  if (restaurantError) {
    if (restaurantError.code === "23505") {
      throw new Error("Ya existe un restaurante con ese Place ID.");
    }
    throw restaurantError;
  }

  const restaurantId = Number(restaurant.id);
  const mapsUrl = optionalText(input.googleMapsUrl);

  const { error: integrationError } = await client
    .from(SUPABASE_TABLES.restaurante_integraciones)
    .insert([
      {
        restaurante_id: restaurantId,
        provider: "google_maps",
        status: "connected",
        external_ref: placeId,
        config: mapsUrl ? { url: mapsUrl } : {},
      },
      {
        restaurante_id: restaurantId,
        provider: "apify",
        status: "pending",
        external_ref: placeId,
        config: mapsUrl ? { google_maps_url: mapsUrl } : {},
      },
    ]);

  if (integrationError) {
    await client.from(SUPABASE_TABLES.restaurantes).delete().eq("id", restaurantId);
    throw integrationError;
  }

  return {
    id: restaurantId,
    nombre: String(restaurant.nombre),
    integrations: {
      googleMaps: "connected",
      apify: "pending",
    },
  };
}
