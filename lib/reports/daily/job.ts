import { currentSlot, type DailySlot } from "./calendar";
import { buildSnapshot, type DailyReportSnapshot, type RestaurantInfo, type WindowMetrics } from "./snapshot";

/**
 * Job del informe diario de las 09:00 (Europe/Madrid). Núcleo sin dependencias de Next, Supabase ni Meta:
 * la persistencia y el envío se inyectan (ver `process.server.ts`).
 *
 * Para cada contacto con WhatsApp ACTIVO y al menos un restaurante accesible:
 *   1. RESERVA su envío (contacto, día del slot, plantilla) antes de nada: una ejecución repetida o
 *      concurrente no puede mandar dos plantillas del mismo slot.
 *   2. Calcula y guarda la FOTO (snapshot) del informe con los restaurantes que puede ver AHORA (slot).
 *   3. Envía la plantilla `informe_diario` ({{1}} nombre, {{2}} descripción del periodo), sin botón.
 *   4. Registra el resultado. Un fallo queda registrado y NO se reintenta solo.
 * El snapshot usa el SLOT lógico de las 09:00, nunca `Date.now()`.
 */

export const DAILY_REPORT_TEMPLATE = "informe_diario";

export type EligibleContact = { id: string; name: string | null };

export type WindowData = {
  restaurants: Map<number, RestaurantInfo>;
  metrics: Map<number, WindowMetrics>;
  reasons: Map<number, string | null>;
};

export type SendResult =
  | { status: "sent"; messageId: string; wamid: string | null; conversationId: string }
  | { status: "failed"; code: string; reason: string; conversationId?: string | null };

export interface DailyReportJobDeps {
  now?: () => Date;
  /** Contactos con `whatsapp_activated_at` no nulo. */
  listActivatedContacts(): Promise<EligibleContact[]>;
  /** Restaurantes accesibles HOY por contacto (conv_contacto_empresas / conv_contacto_restaurantes; deny by default). */
  resolveRestaurantIds(contactIds: string[]): Promise<Map<string, number[]>>;
  /** Contactos que ya tienen fila de ese slot (enviada, fallida o reservada). */
  listContactsWithEnvio(slotDate: string): Promise<Set<string>>;
  loadWindowData(restaurantIds: number[], slot: DailySlot): Promise<WindowData>;
  /** Reserva atómica; `null` si ya existe (otra ejecución se adelantó). */
  reserve(input: { contactId: string; slot: DailySlot; template: string }): Promise<{ id: string } | null>;
  saveSnapshot(envioId: string, snapshot: DailyReportSnapshot): Promise<void>;
  send(input: { contactId: string; contactName: string | null; slot: DailySlot; requestSeed: string }): Promise<SendResult>;
  markSent(envioId: string, result: Extract<SendResult, { status: "sent" }>, at: Date): Promise<void>;
  markFailed(envioId: string, result: Extract<SendResult, { status: "failed" }>): Promise<void>;
  /** Tiempo máximo de la ejecución; lo que no dé tiempo lo recoge la siguiente (la reserva lo evita duplicar). */
  budgetMs?: number;
  log?: (message: string) => void;
}

export type DailyReportRunResult =
  | { status: "outside_window" }
  | {
      status: "ran";
      kind: DailySlot["kind"];
      slotDate: string;
      activated: number;
      eligible: number;
      alreadyDone: number;
      sent: number;
      failed: number;
      lostRace: number;
      remaining: number;
    };

const DEFAULT_BUDGET_MS = 45_000;

export async function runDailyReport(deps: DailyReportJobDeps): Promise<DailyReportRunResult> {
  const now = (deps.now ?? (() => new Date()))();
  const slot = currentSlot(now);
  if (!slot) return { status: "outside_window" };

  const startedAt = Date.now();
  const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS;

  const activated = await deps.listActivatedContacts();
  const accessByContact = await deps.resolveRestaurantIds(activated.map((contact) => contact.id));
  const eligible = activated.filter((contact) => (accessByContact.get(contact.id)?.length ?? 0) > 0);

  const done = await deps.listContactsWithEnvio(slot.slotDate);
  const pending = eligible.filter((contact) => !done.has(contact.id));

  const result = {
    status: "ran" as const,
    kind: slot.kind,
    slotDate: slot.slotDate,
    activated: activated.length,
    eligible: eligible.length,
    alreadyDone: eligible.length - pending.length,
    sent: 0,
    failed: 0,
    lostRace: 0,
    remaining: 0,
  };
  if (pending.length === 0) return result;

  // Las métricas de la ventana se calculan UNA vez para la unión de restaurantes y se reparten por contacto.
  const union = [...new Set(pending.flatMap((contact) => accessByContact.get(contact.id) ?? []))];
  const data = await deps.loadWindowData(union, slot);

  for (const [index, contact] of pending.entries()) {
    if (Date.now() - startedAt > budget) {
      result.remaining = pending.length - index;
      break;
    }

    const reservation = await deps.reserve({ contactId: contact.id, slot, template: DAILY_REPORT_TEMPLATE });
    if (!reservation) {
      result.lostRace += 1;
      continue;
    }

    try {
      const allowed = accessByContact.get(contact.id) ?? [];
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
        contactId: contact.id,
        contactName: contact.name,
        slot,
        requestSeed: `${DAILY_REPORT_TEMPLATE}:${contact.id}:${slot.slotDate}`,
      });

      if (sent.status === "sent") {
        await deps.markSent(reservation.id, sent, now);
        result.sent += 1;
      } else {
        await deps.markFailed(reservation.id, sent);
        result.failed += 1;
      }
    } catch (error) {
      result.failed += 1;
      // Solo el tipo de error: nunca teléfonos, nombres ni contenido.
      await deps
        .markFailed(reservation.id, { status: "failed", code: "exception", reason: error instanceof Error ? error.name : "Error" })
        .catch(() => undefined);
      deps.log?.(`[daily-report] contact_failed slot=${slot.slotDate} contactId=${contact.id}`);
    }
  }

  return result;
}
