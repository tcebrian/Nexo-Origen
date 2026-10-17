import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import {
  ACTIVE_COMPANY_COOKIE,
  ACTIVE_COMPANY_COOKIE_MAX_AGE,
  encodeCompanyCookie,
  validateCompanySelection,
} from "@/lib/company/access";
import { getCurrentSessionKey } from "@/lib/company/session-key.server";

export const dynamic = "force-dynamic";

/**
 * Selecciona la empresa activa. Body: { companyId: number }.
 *
 * El navegador solo PIDE una empresa; el servidor la valida contra las empresas que el usuario tiene permitidas
 * (calculadas en `getAuthSession` desde su rol y asignaciones reales, nunca desde la petición). Si no está entre
 * ellas → 403 y no se guarda nada. La cookie es httpOnly y, aun así, se vuelve a validar en cada petición.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { companyId?: unknown } | null;
  const selection = validateCompanySelection({ companies: auth.session.companies }, body?.companyId);
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: selection.status });

  const response = NextResponse.json(
    { company: selection.company },
    { headers: { "Cache-Control": "private, no-store" } }
  );
  // super_admin: la elección queda atada a ESTA sesión y es una cookie de sesión (sin caducidad): un login nuevo
  // o cerrar el navegador la dejan sin efecto y vuelve a empezar en la selección. Usuarios normales: como antes.
  const superAdmin = isSuperAdmin(normalizeRole(auth.session.perfil.rol));
  response.cookies.set(
    ACTIVE_COMPANY_COOKIE,
    encodeCompanyCookie(selection.company.id, superAdmin ? await getCurrentSessionKey() : null),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(superAdmin ? {} : { maxAge: ACTIVE_COMPANY_COOKIE_MAX_AGE }),
    }
  );
  return response;
}

/** Olvida la empresa activa (se llama al cerrar sesión). No concede nada, solo borra la cookie. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(ACTIVE_COMPANY_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
