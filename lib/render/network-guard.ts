import type { Page } from "playwright-core";

/**
 * Red de Chromium en el renderer: solo se deja pasar lo imprescindible.
 *  - `data:` y `about:` siempre (el HTML de los informes lleva fuentes e imágenes incrustadas).
 *  - El origen propio del despliegue, solo cuando la operación navega a una plantilla suya.
 *  - Todo lo demás se aborta: ni internet, ni la red interna (SSRF), ni metadatos de la nube.
 * Así, aunque un dato llevara una `<img src="http://…">`, el navegador no sale a ningún sitio.
 */
export function isRequestAllowed(url: string, allowedOrigin: string | null): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "data:" || parsed.protocol === "about:") return true;
  if (allowedOrigin && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
    return parsed.origin === allowedOrigin;
  }
  return false;
}

/** Instala el filtro. Se registra el primero: cualquier otra ruta posterior tiene prioridad sobre él. */
export async function installNetworkGuard(page: Page, allowedOrigin: string | null): Promise<void> {
  await page.route("**/*", (route) => {
    if (isRequestAllowed(route.request().url(), allowedOrigin)) return route.fallback();
    return route.abort("blockedbyclient");
  });
}
