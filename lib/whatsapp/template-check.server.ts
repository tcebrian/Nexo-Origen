import "server-only";

import { GRAPH_API_VERSION } from "@/lib/whatsapp/cloud-api.server";
import { parseProviderError, type ProviderError } from "@/lib/whatsapp/provider-error";

/**
 * DIAGNÓSTICO TEMPORAL (solo lectura): ¿cómo está registrada una plantilla en Meta?
 * Consulta `GET /{WABA}/message_templates?name=…&fields=name,language,status,category,id`.
 *
 *  - El WABA está fijado AQUÍ, en el servidor: nunca viene de la petición.
 *  - Solo se pueden consultar los nombres de `CHECKABLE_TEMPLATES`.
 *  - No modifica nada en Meta ni en Nexo. El token solo viaja en la cabecera `Authorization` hacia Meta:
 *    no se devuelve, no se registra y se elimina de cualquier mensaje de error.
 */

export const TEMPLATE_CHECK_WABA_ID = "1743350907791174";
export const CHECKABLE_TEMPLATES = ["bienvenido_nexo"] as const;
export type CheckableTemplate = (typeof CHECKABLE_TEMPLATES)[number];

export function isCheckableTemplate(value: unknown): value is CheckableTemplate {
  return typeof value === "string" && (CHECKABLE_TEMPLATES as readonly string[]).includes(value);
}

export type TemplateInfo = { name: string; language: string | null; status: string | null; category: string | null; id: string | null };

export type TemplateCheckResult =
  | { ok: true; name: CheckableTemplate; templates: TemplateInfo[] }
  | { ok: false; reason: "misconfigured" }
  | { ok: false; reason: "meta_error"; error: ProviderError }
  | { ok: false; reason: "unreachable" };

const str = (value: unknown): string | null => (typeof value === "string" && value.length <= 100 ? value : null);

export async function checkTemplate(
  name: CheckableTemplate,
  deps: { accessToken?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<TemplateCheckResult> {
  const accessToken = (deps.accessToken ?? process.env.WHATSAPP_CLOUD_ACCESS_TOKEN)?.trim();
  if (!accessToken) return { ok: false, reason: "misconfigured" };

  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${TEMPLATE_CHECK_WABA_ID}/message_templates` +
    `?${new URLSearchParams({ name, fields: "name,language,status,category,id", limit: "50" }).toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15_000);
  try {
    const response = await (deps.fetchImpl ?? fetch)(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { data?: unknown } | null;

    if (!response.ok) return { ok: false, reason: "meta_error", error: parseProviderError(response.status, body, [accessToken]) };

    const rows = Array.isArray(body?.data) ? body!.data : [];
    const templates = rows
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      // El filtro `name` de Meta puede traer plantillas parecidas: solo cuenta el nombre exacto.
      .filter((row) => row.name === name)
      .map((row) => ({ name, language: str(row.language), status: str(row.status), category: str(row.category), id: str(row.id) }));
    return { ok: true, name, templates };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
