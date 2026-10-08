import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import type { Perfil } from "@/lib/auth/types";

/**
 * Cambio de contraseña obligatorio en el primer acceso. La página de cambio vive en
 * `/auth/change-password`, fuera de `/dashboard` y de `/api` (que son lo único que
 * protege el middleware), así que redirigir hacia ella no puede crear un bucle.
 */
export const CHANGE_PASSWORD_PATH = "/auth/change-password";

/**
 * ¿Debe esta persona cambiar su contraseña antes de seguir? El perfil puede venir de
 * una caché de 30 s: si la caché dice "sí", se confirma con una lectura FRESCA para que,
 * justo después de cambiarla, no vuelva a ser enviada a la pantalla de cambio. Si la
 * lectura falla se mantiene el "sí" (más seguro).
 */
export async function isPasswordChangePending(perfil: Pick<Perfil, "id" | "mustChangePassword">): Promise<boolean> {
  if (!perfil.mustChangePassword) return false;
  const fresh = await fetchPerfilFresh(perfil.id);
  return fresh ? fresh.mustChangePassword : true;
}
