import "server-only";

import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import { fetchUserScope } from "@/lib/auth/scopes";
import type { UserScope } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { DENY_SCOPE, restaurantIdsFromScope } from "@/lib/conversations/contact-access";

/**
 * Alcance de datos de un CONTACTO de WhatsApp. No existe un sistema de permisos
 * propio de Conversations: el contacto se vincula a una persona de Nexo
 * (`conv_contactos.usuario_id`) y su alcance es el de esa persona, calculado por
 * la MISMA función que la web (`fetchUserScope`). Se resuelve en cada llamada
 * (nunca se copia ni se cachea): si ayer tenía 4 restaurantes y hoy 3, hoy son 3.
 *
 * DENY BY DEFAULT: contacto inexistente, sin usuario vinculado, sin perfil o con
 * un error de lectura ⇒ alcance vacío. El alcance se fuerza (`enforceScoping`)
 * para que ningún contacto vea todo cuando la web tiene el filtrado desactivado.
 */

async function findLinkedUserId(contactoId: string): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from(SUPABASE_TABLES.conv_contactos)
    .select("usuario_id")
    .eq("id", contactoId)
    .maybeSingle();

  if (error || !data) return null;
  const userId = (data as { usuario_id: string | null }).usuario_id;
  return typeof userId === "string" && userId !== "" ? userId : null;
}

/** Alcance del usuario de Nexo vinculado al contacto; vacío (deny) si no hay vínculo válido. */
export async function resolveContactDataScope(contactoId: string): Promise<UserScope> {
  try {
    const userId = await findLinkedUserId(contactoId);
    if (!userId) return DENY_SCOPE;

    // Perfil sin caché: un cambio de rol o de empresa vale desde el siguiente mensaje.
    const perfil = await fetchPerfilFresh(userId);
    if (!perfil) return DENY_SCOPE;

    return await fetchUserScope(userId, perfil, { enforceScoping: true });
  } catch {
    return DENY_SCOPE;
  }
}

/** Ids de restaurante que el contacto puede consultar HOY (lista vacía = ninguno). */
export async function resolveContactRestaurantIds(contactoId: string): Promise<number[]> {
  const scope = await resolveContactDataScope(contactoId);
  if (scope.restauranteIds !== null) return restaurantIdsFromScope(scope, []);

  // Sin restricción (super_admin vinculado): todos los restaurantes existentes.
  const client = getSupabaseAdmin();
  if (!client) return [];
  const { data, error } = await client.from(SUPABASE_TABLES.restaurantes).select("id");
  if (error) return [];
  return restaurantIdsFromScope(
    scope,
    (data ?? []).map((row) => Number((row as { id: number }).id))
  );
}
