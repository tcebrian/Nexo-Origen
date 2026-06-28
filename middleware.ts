import { type NextRequest, NextResponse } from "next/server";
import { fetchPerfilForAuth } from "@/lib/auth/perfiles";
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
  if (!hasSupabaseConfig()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isApiRoute = isProtectedApiPath(pathname);

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
