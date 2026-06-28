import { getAuthSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Comprueba que hay sesión Supabase + perfil válido (tras login). */
export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "perfil" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    rol: session.perfil.rol,
    nombre: session.perfil.nombre,
  });
}
