import { madridClock, slotForDate, type DailySlot } from "./calendar";
import { DAILY_REPORT_TEMPLATE, type DailyReportJobDeps } from "./job";
import { buildSnapshot } from "./snapshot";

/**
 * PRUEBA MANUAL y TEMPORAL del informe diario (botón "Probar informe diario" de Conversaciones).
 *
 * Ejecuta el MISMO flujo que el job de las 09:00, pero para UN contacto y con el slot de AHORA:
 *   restaurantes (solo conv_contacto_empresas / conv_contacto_restaurantes, deny by default) →
 *   slot de hoy (lunes: cierre de la semana anterior; martes–domingo: semana en curso hasta las 09:00) →
 *   métricas de la ventana → snapshot → fila en `conv_informe_envios` → plantilla `informe_diario` →
 *   wamid de ESA plantilla guardado en la fila.
 * Así, al pulsar "Ver informe" sobre ese aviso, el webhook encuentra la fila por `context.id` y manda
 * el snapshot, sin recalcular.
 *
 * Las filas llevan `origen = 'prueba'`: la unicidad (contacto, día, plantilla) solo se aplica a 'job', de
 * modo que una prueba nunca bloquea ni duplica el informe real de las 09:00 y se puede repetir.
 */

export type ManualDailyReportDeps = Pick<
  DailyReportJobDeps,
  "resolveRestaurantIds" | "loadWindowData" | "reserve" | "saveSnapshot" | "send" | "markSent" | "markFailed"
> & { now?: () => Date };

export type ManualDailyReportOutcome =
  | { status: "sent"; slot: DailySlot; envioId: string; messageId: string; wamid: string | null; conversationId: string; restaurants: number }
  | { status: "no_restaurants" }
  | { status: "failed"; code: string; reason: string; conversationId: string | null; envioId: string };

export async function runManualDailyReport(
  input: { contactId: string; contactName: string | null; requestId: string },
  deps: ManualDailyReportDeps
): Promise<ManualDailyReportOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const slot = slotForDate(madridClock(now).date);

  const access = await deps.resolveRestaurantIds([input.contactId]);
  const allowed = access.get(input.contactId) ?? [];
  // Deny by default: sin restaurantes asignados no se calcula ni se envía nada.
  if (allowed.length === 0) return { status: "no_restaurants" };

  const data = await deps.loadWindowData(allowed, slot);

  const reservation = await deps.reserve({ contactId: input.contactId, slot, template: DAILY_REPORT_TEMPLATE, origin: "prueba" });
  // Una fila de prueba nunca choca (índice único solo para 'job'); null solo si la base lo impidiera.
  if (!reservation) throw new Error("daily-report manual-test: no se pudo reservar la fila de prueba");

  try {
    const snapshot = buildSnapshot({
      slot,
      restaurants: allowed.flatMap((id) => {
        const info = data.restaurants.get(id);
        return info ? [info] : [];
      }),
      metrics: data.metrics,
      reasons: data.reasons,
    });
    await deps.saveSnapshot(reservation.id, snapshot);

    const sent = await deps.send({
      contactId: input.contactId,
      contactName: input.contactName,
      slot,
      // Una pulsación = un envío (doble clic con el mismo requestId no duplica el mensaje).
      requestSeed: `${DAILY_REPORT_TEMPLATE}:prueba:${input.contactId}:${input.requestId}`,
    });

    if (sent.status === "sent") {
      await deps.markSent(reservation.id, sent, now);
      return {
        status: "sent",
        slot,
        envioId: reservation.id,
        messageId: sent.messageId,
        wamid: sent.wamid,
        conversationId: sent.conversationId,
        restaurants: snapshot.restaurants.length,
      };
    }
    await deps.markFailed(reservation.id, sent);
    return { status: "failed", code: sent.code, reason: sent.reason, conversationId: sent.conversationId ?? null, envioId: reservation.id };
  } catch (error) {
    await deps
      .markFailed(reservation.id, { status: "failed", code: "exception", reason: error instanceof Error ? error.name : "Error" })
      .catch(() => undefined);
    throw error;
  }
}
