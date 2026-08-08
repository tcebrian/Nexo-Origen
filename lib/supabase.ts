import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Cliente browser (SSR-aware), creado de forma perezosa.
 * No instanciar a nivel de módulo: rompería cualquier import server-side
 * (incluida esta importación transitiva) cuando faltan las credenciales.
 */
export function getSupabase() {
  return createBrowserSupabaseClient();
}

export { createClient } from "@/lib/supabase/client";
