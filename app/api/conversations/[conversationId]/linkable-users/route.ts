import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { listLinkableUsers } from "@/lib/conversations/contact-link.server";
import { isValidConversationId } from "@/lib/conversations/read-model";

export const dynamic = "force-dynamic";

/** Personas de Nexo que se pueden vincular al contacto de esta conversación. */
export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  try {
    return NextResponse.json({ users: await listLinkableUsers(conversationId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] linkable users failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar los usuarios" }, { status: 500 });
  }
}
