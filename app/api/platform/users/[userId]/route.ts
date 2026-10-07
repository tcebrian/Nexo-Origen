import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { UserAccessError, getManagedUserDetail, setManagedUserAccess } from "@/lib/auth/user-access.server";
import { isValidConversationId } from "@/lib/conversations/read-model";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ userId: string }> };

async function authorize(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return { response: auth.response } as const;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return { response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) } as const;
  }
  return { session: auth.session } as const;
}

/** Acceso guardado, acceso efectivo de hoy y opciones del formulario. Solo super_admin. */
export async function GET(request: Request, { params }: Context) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  const { userId } = await params;
  if (!isValidConversationId(userId)) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });

  try {
    const detail = await getManagedUserDetail(userId);
    if (!detail) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[platform/users] detail failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo cargar el usuario" }, { status: 500 });
  }
}

/**
 * Deja el acceso del usuario EXACTAMENTE como la selección enviada
 * ({ rol, empresaId, restaurantIds, marcaIds }) en una sola transacción.
 */
export async function PUT(request: Request, { params }: Context) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  const { userId } = await params;
  if (!isValidConversationId(userId)) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });

  const body = await request.json().catch(() => null);

  try {
    await setManagedUserAccess({ userId: result.session.userId, rol: result.session.perfil.rol }, userId, body);
    const detail = await getManagedUserDetail(userId);
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[platform/users] save failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar el acceso" }, { status: 500 });
  }
}
