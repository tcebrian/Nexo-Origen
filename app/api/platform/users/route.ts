import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { UserAccessError, listManagedUsers } from "@/lib/auth/user-access.server";
import { createManagedUser } from "@/lib/auth/user-creation.server";

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

/**
 * Alta de un usuario: { nombre, email, empresaId, tipo: "empresa" | "marca" | "supervisor",
 * restaurantIds?, marcaIds? }. Crea la cuenta sin contraseña, su perfil y sus asignaciones,
 * y devuelve un enlace de un solo uso para que la persona fije su contraseña.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  try {
    const created = await createManagedUser(
      { userId: auth.session.userId, rol: auth.session.perfil.rol },
      body,
      new URL(request.url).origin
    );
    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UserAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    // Solo el mensaje técnico: nunca email, nombre ni enlace.
    console.error("[platform/users] create failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 });
  }
}
