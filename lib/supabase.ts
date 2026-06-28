import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

/** Cliente browser (SSR-aware). Mantiene compatibilidad con imports existentes. */
export const supabase = createBrowserSupabaseClient();

export { createClient } from "@/lib/supabase/client";
