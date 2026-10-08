import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { UserAccessError } from "@/lib/auth/user-access.server";
import { setManagedUserPassword } from "@/lib/auth/user-creation.server";
import { isValidConversationId } from "@/lib/conversations/read-model";

export const dynamic = "force-dynamic";

/**
 * Un super_admin fija una nueva contraseña a una cuenta existente:
 * { password, mustChangePassword? }. La contraseña solo viaja a Supabase Auth; la respuesta no
 * la devuelve y no se registra. La contraseña actual no se puede consultar (Supabase no la expone).
 */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId } = await params;
  if (!isValidConversationId(userId)) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });

  const body = await request.json().catch(() => null);

  try {
    await setManagedUserPassword({ userId: auth.session.userId, rol: auth.session.perfil.rol }, userId, body);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UserAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[platform/users] set password failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar la contraseña" }, { status: 500 });
  }
}
