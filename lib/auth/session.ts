import "server-only";

import { fetchAssignedRestaurants } from "@/lib/auth/assigned-restaurant";
import { fetchPerfilForAuth } from "@/lib/auth/perfiles";
import { isPerfilAuthorized, normalizeRole } from "@/lib/auth/permissions";
import { fetchUserScope } from "@/lib/auth/scopes";
import type { AuthSession } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const perfilResult = await fetchPerfilForAuth(user.id, supabase);

  if (!isPerfilAuthorized(perfilResult.perfil)) {
    return null;
  }

  const scope = await fetchUserScope(user.id, perfilResult.perfil!);
  const assignedRestaurants =
    normalizeRole(perfilResult.perfil!.rol) === "restaurante_user"
      ? await fetchAssignedRestaurants(user.id)
      : [];

  return {
    userId: user.id,
    email: user.email ?? perfilResult.perfil!.email ?? "",
    perfil: perfilResult.perfil!,
    scope,
    assignedRestaurants,
  };
}
