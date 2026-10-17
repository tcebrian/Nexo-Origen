import { NextResponse } from "next/server";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company/access";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // La empresa activa también se olvida al cerrar sesión: el siguiente login vuelve a la selección.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_COMPANY_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
