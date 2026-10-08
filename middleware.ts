import { type NextRequest, NextResponse } from "next/server";
import { fetchPerfilForAuth } from "@/lib/auth/perfiles";
import { CHANGE_PASSWORD_PATH, isPasswordChangePending } from "@/lib/auth/password-gate";
import { isPerfilAuthorized, normalizeRole } from "@/lib/auth/permissions";
import {
  canAccessDashboardPath,
  isProtectedApiPath,
  isSuperAdminApiPath,
} from "@/lib/auth/route-guard";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/middleware";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isApiRoute = isProtectedApiPath(pathname);

  if (!hasSupabaseConfig()) {
    // Sin credenciales de Supabase no se puede verificar sesión ni rol:
    // las rutas protegidas deben bloquearse, no dejarse pasar sin autenticar.
    if (isDashboardRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "config");
      return NextResponse.redirect(loginUrl);
    }
    if (isApiRoute) {
      return NextResponse.json({ error: "Servicio no configurado" }, { status: 503 });
    }
    return NextResponse.next();
  }

  const { supabase, response } = createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isDashboardRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { perfil, denied } = await fetchPerfilForAuth(user.id, supabase);

    if (!isPerfilAuthorized(perfil)) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", denied ? "perfil_rls" : "perfil");
      return NextResponse.redirect(loginUrl);
    }

    // Primera sesión con contraseña inicial: no se entra al dashboard hasta cambiarla.
    // `/auth/change-password` no cuelga de /dashboard ni de /api, así que no hay bucle.
    if (await isPasswordChangePending(perfil!)) {
      const changeUrl = request.nextUrl.clone();
      changeUrl.pathname = CHANGE_PASSWORD_PATH;
      changeUrl.search = "";
      return NextResponse.redirect(changeUrl);
    }

    const rol = normalizeRole(perfil!.rol);
    if (!canAccessDashboardPath(rol, pathname)) {
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/dashboard";
      deniedUrl.searchParams.set("error", "forbidden");
      return NextResponse.redirect(deniedUrl);
    }

    return response;
  }

  if (isApiRoute) {
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { perfil } = await fetchPerfilForAuth(user.id, supabase);

    if (!isPerfilAuthorized(perfil)) {
      return NextResponse.json({ error: "Perfil no autorizado" }, { status: 403 });
    }

    if (await isPasswordChangePending(perfil!)) {
      return NextResponse.json(
        { error: "Debes cambiar tu contraseña antes de continuar", code: "password_change_required" },
        { status: 403 }
      );
    }

    if (isSuperAdminApiPath(pathname) && !isSuperAdmin(normalizeRole(perfil!.rol))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
