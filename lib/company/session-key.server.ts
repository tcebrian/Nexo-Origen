import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sessionKeyFromAccessToken } from "./session-key";

/** Clave de la sesión de autenticación actual (`null` si no se puede determinar). */
export async function getCurrentSessionKey(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return sessionKeyFromAccessToken(session?.access_token);
  } catch {
    return null;
  }
}
