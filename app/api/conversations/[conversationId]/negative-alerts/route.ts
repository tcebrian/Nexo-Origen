import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { setConversationNegativeAlerts } from "@/lib/conversations/contact-link.server";
import { isValidConversationId } from "@/lib/conversations/read-model";
import { rateLimitAuthenticatedUser } from "@/lib/security/rate-limit.server";

export const dynamic = "force-dynamic";

/**
 * Interruptor "Reseñas negativas" de la ficha del contacto (solo super_admin). Body: { enabled: boolean }.
 * Solo escribe `conv_contactos.recibir_alertas_negativas`: NO concede acceso a restaurantes, NO cambia
 * permisos, activación ni informe diario. El alcance sigue saliendo de conv_contacto_empresas / _restaurantes.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const limited = await rateLimitAuthenticatedUser("conversation-negative-alerts", auth.session.userId);
  if (limited) return limited;

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Valor no válido" }, { status: 400 });

  try {
    const found = await setConversationNegativeAlerts(conversationId, body.enabled);
    if (!found) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    return NextResponse.json({ enabled: body.enabled }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] negative alerts toggle failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar el cambio" }, { status: 500 });
  }
}
