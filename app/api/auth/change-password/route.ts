import { NextResponse } from "next/server";
import { UserAccessError } from "@/lib/auth/user-access.server";
import { changeOwnPassword } from "@/lib/auth/user-creation.server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * La persona autenticada cambia SU contraseña: { password }. Sirve para el cambio obligatorio del
 * primer acceso, el cambio voluntario y la elección tras recuperarla por email.
 *
 * `/api/auth/` es público para el middleware, así que aquí se exige la sesión. El servidor guarda
 * la contraseña en Supabase Auth y SOLO entonces baja `must_change_password`: no se puede saltar
 * el cambio obligatorio llamando a otra ruta. La contraseña no se guarda, no se registra y no se
 * devuelve.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;

  try {
    await changeOwnPassword(user.id, body?.password);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UserAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[auth] change password failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo guardar la contraseña" }, { status: 500 });
  }
}
