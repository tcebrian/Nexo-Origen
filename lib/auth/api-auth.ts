import { NextResponse } from "next/server";
import { isSuperAdminApiPath } from "@/lib/auth/route-guard";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { getAuthSession } from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";

export type ApiAuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; response: NextResponse };

export async function requireApiAuth(request: Request): Promise<ApiAuthResult> {
  const session = await getAuthSession();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }
  const { pathname } = new URL(request.url);

  if (isSuperAdminApiPath(pathname) && !isSuperAdmin(normalizeRole(session.perfil.rol))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
