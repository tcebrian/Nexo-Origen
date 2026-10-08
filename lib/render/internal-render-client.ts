import "server-only";

import {
  RENDER_CLIENT_TIMEOUT_MS,
  RENDER_CONTENT_TYPES,
  RENDER_PATH,
  RENDER_SIGNATURE_HEADER,
  RENDER_TIMESTAMP_HEADER,
  VERCEL_BYPASS_HEADER,
  renderSecret,
  resolveInternalOrigin,
  signRenderBody,
  type RenderRequest,
} from "@/lib/render/protocol";

/**
 * Cliente del renderer interno. Es lo único que las rutas públicas (informes, alertas, Conversations)
 * importan para obtener un PDF o una imagen: no carga Chromium, sharp ni playwright, así que esas
 * funciones no los empaquetan. Las rutas ya han resuelto auth, scope y datos; el renderer solo dibuja.
 *
 * El destino lo fija el servidor (`resolveInternalOrigin`) y la petición va firmada con HMAC.
 * Los errores conservan el mensaje que antes lanzaba el generador local, para que las rutas
 * respondan igual que antes.
 */

export class RenderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export type RenderClientDeps = {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  timeoutMs?: number;
};

export async function renderViaInternal(request: RenderRequest, deps: RenderClientDeps = {}): Promise<Buffer> {
  const env = deps.env ?? process.env;
  const secret = renderSecret(env);
  if (!secret) throw new RenderError("Falta NEXO_INTERNAL_RENDER_TOKEN (mínimo 16 caracteres) para renderizar", 500);

  const rawBody = new TextEncoder().encode(JSON.stringify(request));
  const timestamp = (deps.now ?? Date.now)();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [RENDER_TIMESTAMP_HEADER]: String(timestamp),
    [RENDER_SIGNATURE_HEADER]: signRenderBody(rawBody, secret, timestamp),
  };
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) headers[VERCEL_BYPASS_HEADER] = bypass;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? RENDER_CLIENT_TIMEOUT_MS);
  try {
    const response = await (deps.fetchImpl ?? fetch)(`${resolveInternalOrigin(env)}${RENDER_PATH}`, {
      method: "POST",
      headers,
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = typeof payload?.error === "string" && payload.error ? payload.error : "No se pudo generar el archivo";
      throw new RenderError(message, response.status);
    }

    const expected = RENDER_CONTENT_TYPES[request.op];
    if (!response.headers.get("content-type")?.startsWith(expected)) {
      throw new RenderError("Respuesta del renderer no válida", 502);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new RenderError("El renderer devolvió un archivo vacío", 502);
    return bytes;
  } catch (error) {
    if (error instanceof RenderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new RenderError("El renderer tardó demasiado", 504);
    throw new RenderError("No se pudo contactar con el renderer", 502);
  } finally {
    clearTimeout(timer);
  }
}
