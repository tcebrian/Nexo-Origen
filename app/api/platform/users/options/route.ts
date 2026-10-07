import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { getUserFormOptions } from "@/lib/auth/user-access.server";

export const dynamic = "force-dynamic";

/** Empresas, marcas y restaurantes para el formulario de alta de usuario. Solo super_admin. */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    return NextResponse.json(await getUserFormOptions(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[platform/users] options failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar las opciones" }, { status: 500 });
  }
}
