import { createHash } from "node:crypto";

/**
 * Identificador estable de la SESIÓN de autenticación actual (no del usuario). Cambia en cada login nuevo y
 * se mantiene mientras la sesión dura (también al renovarse el token). Sirve para "atar" la empresa activa de
 * un super_admin a su sesión: una cookie de una sesión anterior deja de valer sin tener que borrarla.
 *
 * No es una credencial ni da acceso a nada: solo decide si una elección de empresa pertenece a ESTA sesión.
 * Se guarda como hash corto; la cookie es httpOnly.
 */
export function sessionKeyFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  const payload = accessToken.split(".")[1];
  if (!payload) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      session_id?: unknown;
      amr?: unknown;
    };
    let source: string | null = typeof claims.session_id === "string" && claims.session_id ? claims.session_id : null;
    if (!source && Array.isArray(claims.amr)) {
      // Respaldo: momento del login (se mantiene al renovar el token).
      const stamp = (claims.amr[0] as { timestamp?: unknown } | undefined)?.timestamp;
      if (typeof stamp === "number" || typeof stamp === "string") source = `amr:${stamp}`;
    }
    return source ? createHash("sha256").update(`nexo-company-session:${source}`).digest("hex").slice(0, 24) : null;
  } catch {
    return null;
  }
}
