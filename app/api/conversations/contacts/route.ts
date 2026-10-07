import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { getUserFormOptions } from "@/lib/auth/user-access.server";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { CONTACT_TYPES } from "@/lib/conversations/contact-access";
import { ContactError } from "@/lib/conversations/contact-link.server";
import { parseManualContactBody } from "@/lib/conversations/manual-contact";
import { createManualContact } from "@/lib/conversations/manual-contact.server";

export const dynamic = "force-dynamic";

/** Empresas, marcas, restaurantes y tipos para el formulario de contacto (solo super_admin). */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    return NextResponse.json(
      { types: CONTACT_TYPES, options: await getUserFormOptions() },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[conversations] contact options failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar las opciones" }, { status: 500 });
  }
}

/**
 * Alta manual de un contacto de WhatsApp:
 * { nombre?, countryCallingCode, nationalNumber, tipo?, empresaId?, todosRestaurantes?, restaurantIds? }.
 * Los permisos se eligen aquí (empresa y restaurantes): no hace falta ninguna cuenta web. Un
 * teléfono existente se reutiliza (200) sin modificarlo; se edita desde su ficha.
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
      access: parsed.access,
    });
    return NextResponse.json(
      { existing: result.status === "existing", conversationId: result.conversationId },
      { status: result.status === "created" ? 201 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ContactError) return NextResponse.json({ error: error.message }, { status: error.status });
    // Solo operación y SQLSTATE: nunca teléfonos ni nombres.
    console.error("[conversations] manual contact failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo crear el contacto" }, { status: 500 });
  }
}
