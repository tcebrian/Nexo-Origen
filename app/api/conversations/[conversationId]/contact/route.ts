import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import {
  ContactError,
  getConversationContactDetail,
  setConversationContactUser,
  updateConversationContact,
} from "@/lib/conversations/contact-link.server";
import { isValidConversationId } from "@/lib/conversations/read-model";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ conversationId: string }> };

async function authorize(request: Request, params: Context["params"]) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return { response: auth.response } as const;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return { response: NextResponse.json({ error: access.error }, { status: access.status }) } as const;

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return { response: NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 }) } as const;
  }
  return { conversationId } as const;
}

/** Ficha del contacto: permisos guardados, acceso de hoy y cuenta web vinculada (opcional, informativa). */
export async function GET(request: Request, { params }: Context) {
  const result = await authorize(request, params);
  if ("response" in result) return result.response;

  try {
    const detail = await getConversationContactDetail(result.conversationId);
    if (!detail) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] contact failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo cargar el contacto" }, { status: 500 });
  }
}

/**
 * Edita nombre, tipo, empresa, "todos" y restaurantes del contacto, en una transacción:
 * el contacto queda EXACTAMENTE con la selección enviada. Es la única vía para cambiar
 * sus permisos; no dependen de ninguna cuenta web.
 */
export async function PATCH(request: Request, { params }: Context) {
  const result = await authorize(request, params);
  if ("response" in result) return result.response;

  try {
    const detail = await updateConversationContact(result.conversationId, await request.json().catch(() => null));
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ContactError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[conversations] contact update failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar el contacto" }, { status: 500 });
  }
}

/** Vincula (`usuarioId`) o desvincula (`null`) una cuenta web. Opcional e informativo: no cambia permisos. */
export async function PUT(request: Request, { params }: Context) {
  const result = await authorize(request, params);
  if ("response" in result) return result.response;

  const body = (await request.json().catch(() => null)) as { usuarioId?: unknown } | null;
  const usuarioId = body?.usuarioId;
  if (usuarioId !== null && !(typeof usuarioId === "string" && isValidConversationId(usuarioId))) {
    return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });
  }

  try {
    const link = await setConversationContactUser(result.conversationId, usuarioId);
    if (link === "conversation_not_found") return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    if (link === "user_not_found") return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (link === "already_linked") {
      return NextResponse.json({ error: "Esa cuenta ya está vinculada a otro teléfono" }, { status: 409 });
    }
    const detail = await getConversationContactDetail(result.conversationId);
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] contact link failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar el vínculo" }, { status: 500 });
  }
}
