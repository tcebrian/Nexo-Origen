import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { getConversationContactAccess, setConversationContactUser } from "@/lib/conversations/contact-link.server";
import { isValidConversationId } from "@/lib/conversations/read-model";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ conversationId: string }> };

/** Contacto de la conversación, persona de Nexo vinculada y su acceso efectivo de hoy. */
export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  try {
    const summary = await getConversationContactAccess(conversationId);
    if (!summary) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] contact failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo cargar el contacto" }, { status: 500 });
  }
}

/** Vincula (`usuarioId`) o desvincula (`null`) el contacto de una persona de Nexo. */
export async function PUT(request: Request, { params }: Context) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { usuarioId?: unknown } | null;
  const usuarioId = body?.usuarioId;
  if (usuarioId !== null && !(typeof usuarioId === "string" && isValidConversationId(usuarioId))) {
    return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });
  }

  try {
    const result = await setConversationContactUser(conversationId, usuarioId);
    if (result === "conversation_not_found") return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    if (result === "user_not_found") return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (result === "already_linked") {
      return NextResponse.json({ error: "Ese usuario ya está vinculado a otro teléfono" }, { status: 409 });
    }
    const summary = await getConversationContactAccess(conversationId);
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] contact link failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar el vínculo" }, { status: 500 });
  }
}
