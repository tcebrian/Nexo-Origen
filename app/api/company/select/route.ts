import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  ACTIVE_COMPANY_COOKIE,
  ACTIVE_COMPANY_COOKIE_MAX_AGE,
  validateCompanySelection,
} from "@/lib/company/access";

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
  response.cookies.set(ACTIVE_COMPANY_COOKIE, String(selection.company.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_COMPANY_COOKIE_MAX_AGE,
  });
  return response;
}
