/**
 * Lee el cuerpo JSON de una petición con un tope de tamaño REAL: no se fía de `Content-Length` (que puede faltar o
 * mentir), cuenta los bytes mientras lee el flujo y lo corta al pasarse. Compatible con Route Handlers de Next.js.
 *  - 413: el cuerpo supera `maxBytes`.
 *  - 400: vacío o JSON inválido.
 */
export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }
  if (total === 0) return { ok: false, status: 400 };

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false, status: 400 };
  }
}
