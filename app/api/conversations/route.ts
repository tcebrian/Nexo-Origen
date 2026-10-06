import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { listConversations } from "@/lib/conversations/read.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const conversations = await listConversations();
    return NextResponse.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Solo operación y código SQLSTATE: nunca datos de contactos ni mensajes.
    console.error("[conversations] list failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar las conversaciones" }, { status: 500 });
  }
}
