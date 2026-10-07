import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { UserAccessError } from "@/lib/auth/user-access.server";
import { createActivationLink } from "@/lib/auth/user-creation.server";
import { isValidConversationId } from "@/lib/conversations/read-model";

export const dynamic = "force-dynamic";

/**
 * Genera un nuevo enlace de un solo uso para que la persona fije (o restablezca) su
 * contraseña. Solo super_admin. El enlace se devuelve una vez y no se registra ni se guarda.
 */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId } = await params;
  if (!isValidConversationId(userId)) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });

  try {
    const activationUrl = await createActivationLink(
      { userId: auth.session.userId, rol: auth.session.perfil.rol },
      userId,
      new URL(request.url).origin
    );
    return NextResponse.json({ activationUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UserAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[platform/users] activation link failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo generar el enlace" }, { status: 500 });
  }
}
