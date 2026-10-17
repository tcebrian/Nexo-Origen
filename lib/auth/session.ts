import "server-only";

import { fetchAssignedRestaurants, resolveRestaurantsByIds } from "@/lib/auth/assigned-restaurant";
import { fetchPerfilForAuth } from "@/lib/auth/perfiles";
import { isPerfilAuthorized, normalizeRole } from "@/lib/auth/permissions";
import { fetchUserScope } from "@/lib/auth/scopes";
import type { AuthSession } from "@/lib/auth/types";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company/access";
import { resolveCompanyContext, type CompanyContext } from "@/lib/company/context.server";
import { sessionKeyFromAccessToken } from "@/lib/company/session-key";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type LoadedSession = { session: AuthSession; company: CompanyContext };

/** Sesión + contexto de empresas (incluye los restaurantes permitidos por empresa, solo para el servidor). */
export async function getAuthSessionWithCompanies(): Promise<LoadedSession | null> {
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

  const baseScope = await fetchUserScope(user.id, perfilResult.perfil!);
  const rol = normalizeRole(perfilResult.perfil!.rol);

  // EMPRESA ACTIVA. La cookie solo es una petición: el servidor recalcula las empresas permitidas y la acepta
  // únicamente si está entre ellas. Desde aquí `scope` es el alcance acotado a esa empresa, así que TODO el
  // código que ya filtra con `session.scope` (dashboard, reseñas, informes…) queda limitado a la empresa.
  const cookieStore = await cookies();
  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();
  const company = await resolveCompanyContext({
    userId: user.id,
    perfil: perfilResult.perfil!,
    baseScope,
    cookieValue: cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value,
    sessionKey: sessionKeyFromAccessToken(authSession?.access_token),
  });
  const scope = company.scope;

  // Perfil de un solo restaurante (restaurante_user, o empresa/marca admin con un único local):
  // usa la misma vista compacta de "restaurante único".
  const assignedRestaurants =
    rol === "restaurante_user"
      ? await fetchAssignedRestaurants(user.id)
      : scope.restauranteIds?.length === 1
        ? await resolveRestaurantsByIds(scope.restauranteIds)
        : [];

  return {
    company,
    session: {
      userId: user.id,
      email: user.email ?? perfilResult.perfil!.email ?? "",
      perfil: perfilResult.perfil!,
      scope,
      assignedRestaurants,
      companies: company.companies,
      activeCompany: company.activeCompany,
    },
  };
}

export async function getAuthSession(): Promise<AuthSession | null> {
  return (await getAuthSessionWithCompanies())?.session ?? null;
}
