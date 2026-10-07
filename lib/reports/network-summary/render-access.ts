import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { getAuthSession } from "@/lib/auth/session";

/**
 * Control de acceso de la plantilla interna de renderizado de network-summary
 * (`/templates/network-summary/...`). Esa página solo existe para que el
 * Chromium de Nexo la capture como imagen (y para la vista previa del
 * super_admin): no debe ser pública.
 *
 * Se permite únicamente:
 *  - con una sesión válida de super_admin, o
 *  - con la credencial interna `NEXO_INTERNAL_RENDER_TOKEN` en la cabecera
 *    `X-Nexo-Internal-Render-Token`, que solo añade el Chromium del servidor.
 * La credencial vive solo en el entorno del servidor: nunca va en el HTML, en la
 * URL, en logs ni en errores. Sin variable configurada (o demasiado corta) la
 * vía de la cabecera queda cerrada.
 */

export const INTERNAL_RENDER_HEADER = "x-nexo-internal-render-token";

/** Longitud mínima para considerar válida la credencial configurada. */
const MIN_TOKEN_LENGTH = 16;

/** Credencial interna configurada, o `null` si falta o es demasiado débil. */
export function internalRenderToken(): string | null {
  const token = process.env.NEXO_INTERNAL_RENDER_TOKEN?.trim();
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

/** Comparación en tiempo constante, sin filtrar la longitud de la credencial. */
export function isValidInternalRenderToken(
  provided: string | null | undefined,
  expected: string | null = internalRenderToken()
): boolean {
  if (!expected || !provided) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

/** ¿Puede esta petición ver la plantilla? Credencial interna correcta o sesión super_admin. */
export async function canRenderNetworkTemplate(providedToken: string | null | undefined): Promise<boolean> {
  if (isValidInternalRenderToken(providedToken)) return true;

  const session = await getAuthSession();
  return Boolean(session) && isSuperAdmin(normalizeRole(session!.perfil.rol));
}
