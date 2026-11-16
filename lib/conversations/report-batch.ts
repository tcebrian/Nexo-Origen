/**
 * Envío de VARIOS informes de Nexo a una conversación, uno detrás de otro.
 *
 * Cada informe sigue siendo una operación independiente contra
 * `POST /api/conversations/[id]/reports` (una petición = un informe), así que el
 * servidor no cambia: mismas validaciones, scope, idempotencia y tiempo máximo
 * por informe. Este módulo solo decide el ORDEN y qué hacer ante cada respuesta:
 *
 *  - Cada informe usa SU requestId (estable por clave): si se reintenta el lote,
 *    lo ya enviado no se duplica (el servidor deduplica por requestId).
 *  - 429 (límite de envíos por minuto): espera lo que diga el servidor y reintenta
 *    el MISMO informe con el MISMO requestId.
 *  - Errores de la conversación (canal inactivo, ventana de 24 h cerrada, sin
 *    permiso, conversación inexistente, servidor sin configurar): se para el lote,
 *    porque el resto fallaría igual.
 *  - Cualquier otro fallo afecta solo a ese informe: se anota y se sigue.
 *
 * Sin dependencia de React, Next ni fetch: todo se inyecta (probado en `report-batch.test.ts`).
 */

export type ReportBatchItem<T> = {
  /** Identifica el informe dentro del lote (y su requestId). */
  key: string;
  /** Nombre para la interfaz ("BK Soria", "Burger King"). */
  label: string;
  selection: T;
};

export type ReportSendAttempt<M> =
  | { ok: true; messages: M[] }
  | { ok: false; status: number; code?: string; error: string; retryAfterSeconds?: number; messages?: M[] };

export type ReportBatchProgress = {
  /** Informes ya terminados (enviados o fallidos). */
  done: number;
  total: number;
  /** Informe en curso. */
  current: string | null;
  /** Segundos de espera por el límite de envíos, si se está esperando. */
  waitingSeconds: number | null;
};

export type ReportBatchResult = {
  sent: string[];
  failed: { key: string; label: string; error: string }[];
  /** Claves que no se intentaron porque el lote se paró. */
  skipped: string[];
  /** Motivo de la parada, si el lote se paró antes de terminar. */
  stoppedError: string | null;
};

export type ReportBatchDeps<T, M> = {
  send(selection: T, requestId: string): Promise<ReportSendAttempt<M>>;
  /** requestId estable por clave (el mismo en cada reintento). */
  requestIdFor(key: string): string;
  /** El informe se envió: se olvida su requestId (un envío nuevo será otro informe). */
  onSent?(key: string, messages: M[]): void;
  /** Mensajes que llegaron aunque la operación fallara (envío parcial). */
  onPartial?(messages: M[]): void;
  onProgress?(progress: ReportBatchProgress): void;
  wait(ms: number): Promise<void>;
  /** Reintentos por 429 de un mismo informe antes de darlo por fallido. */
  maxRateLimitRetries?: number;
};

/** Errores que no dependen del informe sino de la conversación o la sesión: el resto fallaría igual. */
const STOP_CODES = new Set(["not_found", "channel_inactive", "window_closed", "config"]);
const STOP_STATUSES = new Set([401, 403]);

export const RATE_LIMIT_FALLBACK_SECONDS = 60;
const MAX_WAIT_SECONDS = 120;

export function shouldStopBatch(attempt: Extract<ReportSendAttempt<unknown>, { ok: false }>): boolean {
  return STOP_STATUSES.has(attempt.status) || (attempt.code !== undefined && STOP_CODES.has(attempt.code));
}

export async function sendReportBatch<T, M>(
  items: readonly ReportBatchItem<T>[],
  deps: ReportBatchDeps<T, M>
): Promise<ReportBatchResult> {
  const result: ReportBatchResult = { sent: [], failed: [], skipped: [], stoppedError: null };
  const maxRetries = deps.maxRateLimitRetries ?? 5;
  const total = items.length;
  const progress = (done: number, current: string | null, waitingSeconds: number | null = null) =>
    deps.onProgress?.({ done, total, current, waitingSeconds });

  for (const [index, item] of items.entries()) {
    progress(index, item.label);

    let attempt: ReportSendAttempt<M>;
    let retries = 0;
    for (;;) {
      try {
        attempt = await deps.send(item.selection, deps.requestIdFor(item.key));
      } catch {
        attempt = {
          ok: false,
          status: 0,
          code: "network",
          error: "No se pudo conectar. Comprueba la conversación antes de reenviar.",
        };
      }
      if (attempt.ok || attempt.status !== 429 || retries >= maxRetries) break;
      retries += 1;
      const seconds = Math.min(
        MAX_WAIT_SECONDS,
        Math.max(1, Math.ceil(attempt.retryAfterSeconds ?? RATE_LIMIT_FALLBACK_SECONDS))
      );
      progress(index, item.label, seconds);
      await deps.wait(seconds * 1000);
      progress(index, item.label);
    }

    if (attempt.ok) {
      result.sent.push(item.key);
      deps.onSent?.(item.key, attempt.messages);
      continue;
    }

    if (attempt.messages?.length) deps.onPartial?.(attempt.messages);
    result.failed.push({ key: item.key, label: item.label, error: attempt.error });

    if (shouldStopBatch(attempt)) {
      result.stoppedError = attempt.error;
      result.skipped = items.slice(index + 1).map((rest) => rest.key);
      break;
    }
  }

  progress(result.sent.length + result.failed.length, null);
  return result;
}
