import { renderDailyReport } from "./render-text";
import { isDailyReportSnapshot, type DailyReportSnapshot } from "./snapshot";

/**
 * "Ver informe": qué informe recibe quien pulsa el botón de la plantilla `informe_diario`.
 *
 *  1. El `context.id` del webhook es el wamid de la plantilla a la que responde: localiza SU envío
 *     (`conv_informe_envios`) y, con él, la foto guardada a las 09:00. Si pulsa el jueves un aviso del
 *     martes, recibe el informe DEL MARTES.
 *  2. Sin `context.id` (o sin envío para ese wamid) se usa el último informe enviado a ese contacto dentro
 *     de una ventana segura, y se registra que se usó el respaldo.
 *  3. NADA se recalcula: el texto sale del snapshot. Solo se ocultan los restaurantes cuyo permiso se haya
 *     retirado desde entonces (DENY BY DEFAULT: sin ningún restaurante accesible no se muestra nada).
 */

/** Ventana del respaldo sin `context.id`. */
export const FALLBACK_WINDOW_HOURS = 48;

export type InformeEnvio = {
  id: string;
  contactoId: string;
  slotDate: string;
  snapshot: unknown;
  sentAt: string | null;
};

export interface DailyReportViewDeps {
  findByWamid(wamid: string): Promise<InformeEnvio | null>;
  findLatestForContact(contactId: string, sinceIso: string): Promise<InformeEnvio | null>;
  markViewed(envioId: string, input: { fallback: boolean; count: boolean }): Promise<void>;
  /** Restaurantes accesibles HOY por el contacto. */
  resolveRestaurantIds(contactId: string): Promise<number[]>;
  now?: () => Date;
}

export type DailyReportViewResult =
  | { status: "report"; messages: string[]; fallback: boolean; snapshot: DailyReportSnapshot; envioId: string }
  | { status: "not_found" }
  | { status: "no_access" };

export async function viewDailyReport(
  input: { contactId: string; replyToWamid?: string | null; redelivery: boolean },
  deps: DailyReportViewDeps
): Promise<DailyReportViewResult> {
  const now = (deps.now ?? (() => new Date()))();

  let envio: InformeEnvio | null = null;
  let fallback = false;

  if (input.replyToWamid) {
    const found = await deps.findByWamid(input.replyToWamid);
    // Un wamid de OTRO contacto jamás se sirve a este.
    if (found && found.contactoId === input.contactId) envio = found;
  }

  if (!envio) {
    const since = new Date(now.getTime() - FALLBACK_WINDOW_HOURS * 3_600_000).toISOString();
    envio = await deps.findLatestForContact(input.contactId, since);
    fallback = envio !== null;
  }

  if (!envio || !isDailyReportSnapshot(envio.snapshot)) return { status: "not_found" };

  const allowed = await deps.resolveRestaurantIds(input.contactId);
  if (allowed.length === 0) return { status: "no_access" };

  // Una reentrega del mismo webhook no vuelve a contar como una visualización nueva.
  await deps.markViewed(envio.id, { fallback, count: !input.redelivery });

  return {
    status: "report",
    messages: renderDailyReport(envio.snapshot, { allowedRestaurantIds: new Set(allowed) }),
    fallback,
    snapshot: envio.snapshot,
    envioId: envio.id,
  };
}
