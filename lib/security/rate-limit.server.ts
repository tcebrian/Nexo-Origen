import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SENSITIVE_RATE_LIMITS, type SensitiveOperation } from "./rate-limits";

/**
 * Límite de frecuencia compartido entre instancias (SEC-006).
 *
 * En Vercel cada petición puede caer en una instancia serverless distinta y las instancias se reciclan, así que
 * un contador en memoria NO es fiable por sí solo. El contador vive en Postgres (`api_rate_limits`) y se
 * incrementa de forma atómica con `nexo_rate_limit_hit` (ventana fija), usando service role. La clave la
 * construye siempre el servidor (p. ej. a partir del id del usuario autenticado), nunca el cliente.
 *
 * Si la base de datos no responde (o la migración `sec_006_rate_limit.sql` aún no está aplicada) se usa un
 * contador en memoria por instancia como red de seguridad: es menos preciso, pero evita quedarse sin límite.
 */

export type RateLimitOptions = { limit: number; windowSeconds: number };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};

export type RateLimitDeps = {
  client?: RpcClient | null;
  now?: () => number;
};

const memory = new Map<string, { windowStart: number; hits: number }>();
const MEMORY_MAX_KEYS = 5000;

/** Solo para tests. */
export function resetMemoryRateLimit(): void {
  memory.clear();
}

function consumeInMemory(key: string, options: RateLimitOptions, nowMs: number): RateLimitResult {
  const windowMs = options.windowSeconds * 1000;
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  if (memory.size >= MEMORY_MAX_KEYS) {
    for (const [stored, entry] of memory) if (entry.windowStart < windowStart) memory.delete(stored);
    if (memory.size >= MEMORY_MAX_KEYS) memory.clear();
  }
  const entry = memory.get(key);
  const hits = entry && entry.windowStart === windowStart ? entry.hits + 1 : 1;
  memory.set(key, { windowStart, hits });
  return {
    allowed: hits <= options.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)),
  };
}

export async function consumeRateLimit(
  key: string,
  options: RateLimitOptions,
  deps: RateLimitDeps = {}
): Promise<RateLimitResult> {
  const nowMs = (deps.now ?? Date.now)();
  const client = deps.client === undefined ? (getSupabaseAdmin() as RpcClient | null) : deps.client;

  if (client) {
    try {
      const { data, error } = await client.rpc("nexo_rate_limit_hit", {
        p_bucket: key,
        p_limit: options.limit,
        p_window_seconds: options.windowSeconds,
      });
      const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
      if (!error && row && typeof row.allowed === "boolean") {
        const retry = Number(row.retry_after_seconds);
        return { allowed: row.allowed, retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : options.windowSeconds };
      }
      // Solo el SQLSTATE: nunca la clave (lleva el id de usuario).
      console.warn(`[rate-limit] db limiter unavailable (${error?.code ?? "no-data"}); using in-memory fallback`);
    } catch {
      console.warn("[rate-limit] db limiter failed; using in-memory fallback");
    }
  }

  return consumeInMemory(key, options, nowMs);
}

/**
 * Límite de una operación sensible (SEC-013) para el usuario YA AUTENTICADO. Devuelve `null` si puede continuar o la
 * respuesta 429 lista para devolver. Se llama DESPUÉS de comprobar sesión y rol y ANTES de leer el cuerpo o ejecutar la
 * operación. La operación es una constante de `SENSITIVE_RATE_LIMITS` y `userId` sale de la sesión del servidor: el
 * cliente no puede elegir la clave.
 */
export async function rateLimitAuthenticatedUser(operation: SensitiveOperation, userId: string): Promise<Response | null> {
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const result = await consumeRateLimit(`${operation}:${userId}`, SENSITIVE_RATE_LIMITS[operation]);
  if (result.allowed) return null;

  return Response.json(
    { error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } }
  );
}
