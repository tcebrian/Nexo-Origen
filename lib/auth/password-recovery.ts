import { CHANGE_PASSWORD_PATH } from "@/lib/auth/password-gate";

/**
 * Recuperación de contraseña ("¿Olvidaste tu contraseña?"):
 *
 *   login → email → `resetPasswordForEmail` → enlace del email → sesión → /auth/change-password
 *
 * El enlace del email vuelve a `/auth/callback` (PKCE: lo abre el mismo navegador que lo pidió) con
 * `next` apuntando a la pantalla de cambio de contraseña. Con la plantilla de Supabase personalizada
 * para `token_hash` (ver docs) también funciona desde otro dispositivo, a través de `/auth/confirm`.
 * Ambas rutas terminan en la MISMA pantalla, sin duplicar el flujo.
 */
export function buildRecoveryRedirect(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(CHANGE_PASSWORD_PATH)}`;
}

/** Mensaje único tras pedir el enlace: no revela si el email existe. */
export const RECOVERY_SENT_MESSAGE = "Si ese email tiene una cuenta, te hemos enviado un enlace para elegir una contraseña nueva.";

export function isValidRecoveryEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 3 && trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}
