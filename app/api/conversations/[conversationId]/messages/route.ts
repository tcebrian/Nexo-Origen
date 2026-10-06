import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { isValidConversationId } from "@/lib/conversations/read-model";
import { getConversationMessages } from "@/lib/conversations/read.server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  try {
    const messages = await getConversationMessages(conversationId);
    if (!messages) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[conversations] messages failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar los mensajes" }, { status: 500 });
  }
}
