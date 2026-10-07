import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { listLinkableUsers } from "@/lib/conversations/contact-link.server";
import { parseManualContactBody } from "@/lib/conversations/manual-contact";
import { createManualContact } from "@/lib/conversations/manual-contact.server";

export const dynamic = "force-dynamic";

/** Personas de Nexo que se pueden vincular a un contacto nuevo (solo super_admin). */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    return NextResponse.json({ users: await listLinkableUsers(null) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] contacts users failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar los usuarios" }, { status: 500 });
  }
}

/**
 * Alta manual de un contacto de WhatsApp: { nombre?, countryCallingCode, nationalNumber, usuarioId? }.
 * Solo vincula teléfono ↔ persona de Nexo; no acepta restaurantes ni permisos. Un
 * teléfono existente se reutiliza (200) sin sobrescribir su nombre ni su vínculo.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = parseManualContactBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await createManualContact({
      nombre: parsed.nombre,
      telefonoE164: parsed.telefonoE164,
      usuarioId: parsed.usuarioId,
    });

    switch (result.status) {
      case "user_not_found":
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      case "user_already_linked":
        return NextResponse.json({ error: "Ese usuario ya está vinculado a otro teléfono" }, { status: 409 });
      case "phone_linked_to_other_user":
        return NextResponse.json(
          { error: "Este número ya existe y está vinculado a otro usuario. No se ha cambiado." },
          { status: 409 }
        );
      default:
        return NextResponse.json(
          {
            existing: result.status === "existing",
            conversationId: result.conversationId,
            linked: result.linked,
          },
          { status: result.status === "created" ? 201 : 200, headers: { "Cache-Control": "no-store" } }
        );
    }
  } catch (error) {
    // Solo operación y SQLSTATE: nunca teléfonos ni nombres.
    console.error("[conversations] manual contact failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo crear el contacto" }, { status: 500 });
  }
}
