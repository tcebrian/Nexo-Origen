import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifica un enlace de un solo uso (alta de usuario o restablecimiento de contraseña)
 * generado por Nexo y abre la sesión de esa persona. A diferencia de `/auth/callback`
 * (PKCE, que necesita la cookie del navegador que pidió el enlace), aquí el token se
 * verifica en servidor con `token_hash`, así que funciona en el navegador de quien lo
 * recibe. Siempre redirige a una ruta fija: el token no se repite ni se refleja.
 */
const ALLOWED_TYPES = new Set(["recovery", "invite"]);

function redirectTo(origin: string, path: string) {
  return NextResponse.redirect(`${origin}${path}`, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as "recovery" | "invite", token_hash: tokenHash });
    if (!error) return redirectTo(origin, "/auth/set-password");
  }

  // Enlace caducado, ya usado o inválido: mismo mensaje en todos los casos.
  return redirectTo(origin, "/login?error=auth");
}
