import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { listManagedUsers } from "@/lib/auth/user-access.server";

export const dynamic = "force-dynamic";

/** Usuarios de Nexo con su rol, empresa y nº de restaurantes efectivos. Solo super_admin. */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    return NextResponse.json({ users: await listManagedUsers() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[platform/users] list failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar los usuarios" }, { status: 500 });
  }
}
