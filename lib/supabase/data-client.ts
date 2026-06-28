import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./admin";
import { createClient as createServerClient } from "./server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

let serverAnonClient: SupabaseClient | null = null;

function getServerAnonClient(): SupabaseClient {
  if (!serverAnonClient) {
    serverAnonClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverAnonClient;
}

/**
 * Cliente para leer datos en API/rutas servidor.
 * 1) service role (recomendado)  2) sesión del usuario (cookies)  3) anon
 */
export async function getSupabaseDataClientForServer(): Promise<SupabaseClient> {
  const admin = getSupabaseAdmin();
  if (admin) return admin;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[getSupabaseDataClientForServer] SUPABASE_SERVICE_ROLE_KEY no configurada; usando sesión o anon."
    );
  }

  try {
    const sessionClient = await createServerClient();
    const { data } = await sessionClient.auth.getUser();
    if (data.user) return sessionClient;
  } catch {
    // sin cookies de sesión
  }

  return getServerAnonClient();
}
