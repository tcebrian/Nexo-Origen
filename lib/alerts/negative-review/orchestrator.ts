/**
 * Alertas de reseñas negativas por WhatsApp (Conversations). Núcleo sin Next, Supabase ni Meta:
 * persistencia, permisos y envío se inyectan (ver `process.server.ts`).
 *
 * Entra una reseña ≤ 3★ (1★, 2★ o 3★) → para cada contacto CON ACCESO al restaurante (deny by default):
 *
 *   · No activado            → fila `pending`. No se envía nada. Queda lista para cuando pulse "Ver alerta".
 *   · Activado, ventana ABIERTA (≤ 24 h desde su último mensaje) → imagen y después texto con el enlace.
 *   · Activado, ventana CERRADA → plantilla `alerta_negativa`; al pulsar "Ver alerta" se envía el contenido real.
 *     Solo UNA plantilla mientras haya una sin atender: las alertas siguientes quedan pendientes sin enviar otra.
 *   · Ventana ABIERTA pero la imagen falla (generador, subida…) → NO se manda plantilla (el servicio sí está
 *     activo): la alerta queda pendiente y la fila guarda el fallo, la última hora en que escribió y hasta cuándo
 *     dura su ventana. Solo se cae a plantilla si Meta confirma que la ventana está cerrada (131047).
 *
 * Idempotencia: una fila por (reseña, contacto) reservada ANTES de enviar; un reintento del webhook no
 * duplica nada. Un fallo queda registrado y no se reintenta solo.
 */

/** Alertable = estrellas ≤ 3 (1★, 2★ y 3★). Debe coincidir con el trigger `nexo_negative_review_alert_webhook`. */
export const NEGATIVE_ALERT_MAX_STARS = 3;
/** Alertas que se entregan por pulsación de "Ver alerta" (el resto queda pendiente). */
export const ALERTS_PER_VIEW = 10;

export type AlertStatus = "reserved" | "pending" | "notified" | "delivering" | "delivered" | "failed";
export type AlertOrigin = "real" | "prueba";

export type AlertReview = {
  resenaId: number;
  restauranteId: number;
  stars: number;
  restaurantName: string;
};

export type AlertRecipient = {
  contactId: string;
  name: string | null;
  activated: boolean;
};

export type AlertPatch = {
  status?: AlertStatus;
  via?: "direct" | "template" | null;
  conversationId?: string | null;
  templateWamid?: string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  notifiedAt?: Date | null;
  deliveredAt?: Date | null;
};

export type OutstandingAlert = { id: string; resenaId: number; restauranteId: number };

export type DeliverResult =
  | { status: "sent" }
  /** Meta o el generador lo rechazaron: NO se entregó nada (reintentable). */
  | { status: "rejected"; code: string }
  /** No se sabe si salió: no se reenvía a ciegas ni se cae a plantilla. */
  | { status: "uncertain"; code: string };

export type TemplateResult = { status: "sent"; wamid: string | null } | { status: "failed"; code: string };

export interface NegativeAlertDeps {
  now?: () => Date;
  /** `null` si la reseña no existe o no tiene restaurante. */
  loadReview(resenaId: number): Promise<AlertReview | null>;
  /** Contactos con acceso a ESE restaurante (conv_contacto_empresas / conv_contacto_restaurantes). */
  findRecipients(review: AlertReview): Promise<AlertRecipient[]>;
  /** Reserva atómica; `null` si la alerta de ese contacto ya existe. */
  reserve(input: { resenaId: number; contactId: string; restauranteId: number; origin: AlertOrigin }): Promise<{ id: string } | null>;
  update(alertId: string, patch: AlertPatch): Promise<void>;
  conversationFor(contactId: string): Promise<string>;
  /** Último mensaje ENTRANTE de la conversación (inicio de su ventana de 24 h); `null` si nunca escribió. */
  lastInboundAt?(conversationId: string): Promise<Date | null>;
  /** El contacto ya tiene una plantilla `alerta_negativa` enviada y sin atender (alerta en `notified`). */
  hasNotifiedTemplate?(contactId: string): Promise<boolean>;
  isWindowOpen(conversationId: string, now: Date): Promise<boolean>;
  /** Alertas pendientes o ya avisadas con plantilla y aún no entregadas. */
  countOutstanding(contactId: string): Promise<number>;
  /** Imagen + texto con enlace, con ids estables derivados de `requestSeed`. */
  deliverContent(input: { conversationId: string; review: AlertReview; contactId: string; requestSeed: string }): Promise<DeliverResult>;
  sendTemplate(input: { conversationId: string; contactName: string | null; count: number; requestSeed: string }): Promise<TemplateResult>;
  log?: (message: string) => void;
}

export type AlertOutcome =
  | "delivered_direct"
  | "template_sent"
  | "pending_not_activated"
  | "pending_template_failed"
  | "pending_template_already_sent"
  | "pending_image_failed"
  | "already_processed"
  | "failed";

export type ProcessAlertResult =
  | { status: "skipped"; reason: "review_not_found" | "not_negative" }
  | { status: "processed"; restaurantId: number; recipients: number; outcomes: { contactId: string; outcome: AlertOutcome }[] };

/** Semilla de los ids de envío: una por fila de alerta, así el mismo contenido nunca se envía dos veces. */
/** Código de Meta: fuera de la ventana de 24 h (reenganche). Único fallo directo que justifica la plantilla. */
const WINDOW_CLOSED_CODES = new Set(["131047"]);
const WINDOW_MS = 24 * 60 * 60 * 1000;

const seedOf = (resenaId: number, contactId: string, alertId: string) => `negalert:${resenaId}:${contactId}:${alertId}`;

export async function processNegativeReviewAlert(
  input: { resenaId: number; origin?: AlertOrigin; onlyContactId?: string; forceTemplate?: boolean },
  deps: NegativeAlertDeps
): Promise<ProcessAlertResult> {
  const now = deps.now ?? (() => new Date());
  const origin = input.origin ?? "real";

  const review = await deps.loadReview(input.resenaId);
  if (!review) return { status: "skipped", reason: "review_not_found" };
  if (!(review.stars >= 1 && review.stars <= NEGATIVE_ALERT_MAX_STARS)) return { status: "skipped", reason: "not_negative" };

  const everyone = await deps.findRecipients(review);
  const recipients = input.onlyContactId ? everyone.filter((recipient) => recipient.contactId === input.onlyContactId) : everyone;

  const outcomes: { contactId: string; outcome: AlertOutcome }[] = [];

  for (const recipient of recipients) {
    const reservation = await deps.reserve({
      resenaId: review.resenaId,
      contactId: recipient.contactId,
      restauranteId: review.restauranteId,
      origin,
    });
    if (!reservation) {
      outcomes.push({ contactId: recipient.contactId, outcome: "already_processed" });
      continue;
    }

    try {
      const outcome = await handleRecipient(review, recipient, reservation.id, { origin, forceTemplate: input.forceTemplate === true }, deps, now);
      outcomes.push({ contactId: recipient.contactId, outcome });
    } catch (error) {
      await deps
        .update(reservation.id, { status: "failed", errorCode: "exception", errorReason: error instanceof Error ? error.name : "Error" })
        .catch(() => undefined);
      outcomes.push({ contactId: recipient.contactId, outcome: "failed" });
      deps.log?.(`[negative-alert] recipient_failed resenaId=${review.resenaId}`);
    }
  }

  return { status: "processed", restaurantId: review.restauranteId, recipients: recipients.length, outcomes };
}

async function handleRecipient(
  review: AlertReview,
  recipient: AlertRecipient,
  alertId: string,
  options: { origin: AlertOrigin; forceTemplate: boolean },
  deps: NegativeAlertDeps,
  now: () => Date
): Promise<AlertOutcome> {
  // CASO 3: no activado → pendiente, sin enviar nada (ni plantilla).
  if (!recipient.activated) {
    await deps.update(alertId, { status: "pending" });
    return "pending_not_activated";
  }

  const conversationId = await deps.conversationFor(recipient.contactId);
  const windowOpen = !options.forceTemplate && (await deps.isWindowOpen(conversationId, now()));
  const requestSeed = seedOf(review.resenaId, recipient.contactId, alertId);

  // Código con el que Meta confirmó que la ventana estaba cerrada (queda en la fila para poder auditarlo).
  let directFailureCode: string | null = null;

  // CASO 1: ventana abierta → imagen y texto directamente.
  if (windowOpen) {
    await deps.update(alertId, { status: "delivering", conversationId });
    const delivered = await deps.deliverContent({ conversationId, review, contactId: recipient.contactId, requestSeed });
    if (delivered.status === "sent") {
      await deps.update(alertId, { status: "delivered", via: "direct", deliveredAt: now() });
      return "delivered_direct";
    }
    if (delivered.status === "uncertain") {
      await deps.update(alertId, { status: "failed", errorCode: delivered.code, errorReason: "uncertain" });
      return "failed";
    }
    deps.log?.(`[negative-alert] direct_rejected resenaId=${review.resenaId} code=${delivered.code}`);
    if (!WINDOW_CLOSED_CODES.has(delivered.code)) {
      // El servicio SÍ está activo: el fallo es nuestro (imagen, subida…). No se avisa con plantilla como si
      // estuviera inactivo; se deja pendiente y se anota el motivo, su última hora de escritura y el fin de su ventana.
      const last = (await deps.lastInboundAt?.(conversationId)) ?? null;
      const detail = last ? `last_inbound=${last.toISOString()};window_until=${new Date(last.getTime() + WINDOW_MS).toISOString()}` : "last_inbound=unknown";
      await deps.update(alertId, {
        status: "pending",
        conversationId,
        errorCode: delivered.code.slice(0, 40),
        errorReason: `${IMAGE_FAILED_PREFIX}${detail}`,
      });
      return "pending_image_failed";
    }
    // Meta confirma que la ventana ya se había cerrado: nada salió, se avisa con la plantilla.
    directFailureCode = delivered.code;
  }

  // CASO 2: ventana cerrada → plantilla; el contenido real sale al pulsar "Ver alerta".
  await deps.update(alertId, {
    status: "pending",
    conversationId,
    errorCode: directFailureCode ? directFailureCode.slice(0, 40) : null,
    errorReason: directFailureCode ? "direct_rejected" : null,
  });
  // Una sola plantilla por contacto mientras tenga una sin atender: las demás alertas esperan en la misma cola.
  if (!options.forceTemplate && (await deps.hasNotifiedTemplate?.(recipient.contactId))) {
    return "pending_template_already_sent";
  }
  const count = Math.max(1, await deps.countOutstanding(recipient.contactId));
  const template = await deps.sendTemplate({ conversationId, contactName: recipient.name, count, requestSeed });
  if (template.status === "sent") {
    await deps.update(alertId, { status: "notified", via: "template", templateWamid: template.wamid, notifiedAt: now() });
    return "template_sent";
  }
  // Sigue pendiente (se entregará cuando el contacto pulse "Ver alerta" en cualquier aviso).
  await deps.update(alertId, { status: "pending", errorCode: template.code.slice(0, 40), errorReason: "template" });
  return "pending_template_failed";
}

// "Ver alerta" ---------------------------------------------------------------------------------------

export type PendingAlertsResult =
  | { status: "none" }
  | { status: "no_access" }
  | { status: "delivered"; delivered: number; failed: number; remaining: number };

export interface PendingAlertsDeps {
  now?: () => Date;
  /** Restaurantes accesibles HOY por el contacto. */
  resolveRestaurantIds(contactId: string): Promise<number[]>;
  listOutstanding(contactId: string): Promise<OutstandingAlert[]>;
  /** `pending|notified → delivering` atómico; `false` si otra pulsación ya la tomó. */
  claim(alertId: string): Promise<boolean>;
  loadReview(resenaId: number): Promise<AlertReview | null>;
  update(alertId: string, patch: AlertPatch): Promise<void>;
  deliverContent(input: { conversationId: string; review: AlertReview; contactId: string; requestSeed: string }): Promise<DeliverResult>;
}

/**
 * El contacto pulsó "Ver alerta" (su ventana está abierta): se envía el contenido real de sus alertas
 * pendientes, comprobando sus permisos de HOY. Las más antiguas primero; máximo `ALERTS_PER_VIEW`.
 */
export async function deliverPendingAlerts(
  input: { contactId: string; conversationId: string },
  deps: PendingAlertsDeps
): Promise<PendingAlertsResult> {
  const now = deps.now ?? (() => new Date());

  const accessible = new Set(await deps.resolveRestaurantIds(input.contactId));
  if (accessible.size === 0) return { status: "no_access" };

  const outstanding = (await deps.listOutstanding(input.contactId)).filter((alert) => accessible.has(alert.restauranteId));
  if (outstanding.length === 0) return { status: "none" };

  const batch = outstanding.slice(0, ALERTS_PER_VIEW);
  let delivered = 0;
  let failed = 0;

  for (const alert of batch) {
    if (!(await deps.claim(alert.id))) continue;

    const review = await deps.loadReview(alert.resenaId);
    if (!review) {
      await deps.update(alert.id, { status: "failed", errorCode: "review_not_found" });
      failed += 1;
      continue;
    }

    const result = await deps.deliverContent({
      conversationId: input.conversationId,
      review,
      contactId: input.contactId,
      requestSeed: seedOf(alert.resenaId, input.contactId, alert.id),
    });

    if (result.status === "sent") {
      await deps.update(alert.id, { status: "delivered", conversationId: input.conversationId, deliveredAt: now() });
      delivered += 1;
    } else {
      // Vuelve a la cola: se puede reintentar con otra pulsación.
      await deps.update(alert.id, { status: "pending", errorCode: result.code.slice(0, 40), errorReason: result.status });
      failed += 1;
    }
  }

  return { status: "delivered", delivered, failed, remaining: outstanding.length - batch.length };
}

// Reintento de imágenes fallidas ---------------------------------------------------------------------

/** Espera antes de reintentar una alerta cuya imagen falló con la ventana abierta. */
export const IMAGE_RETRY_AFTER_MS = 5 * 60 * 1000;
/** Marca de la fila tras el primer fallo; el reintento solo recoge estas (y deja `image_failed_final` al terminar). */
export const IMAGE_FAILED_PREFIX = "image_failed;";

export type ImageFailedAlert = {
  id: string;
  resenaId: number;
  restauranteId: number;
  contactId: string;
  contactName: string | null;
  conversationId: string;
};

export type ImageRetryResult = { retried: number; delivered: number; noticed: number; templated: number };

export interface ImageRetryDeps {
  now?: () => Date;
  /** Alertas `pending` con `error_reason` que empieza por `image_failed;` creadas antes de `olderThan`. */
  listImageFailed(olderThan: Date): Promise<ImageFailedAlert[]>;
  /** `pending → delivering` atómico; `false` si otro proceso la tomó. */
  claim(alertId: string): Promise<boolean>;
  loadReview(resenaId: number): Promise<AlertReview | null>;
  update(alertId: string, patch: AlertPatch): Promise<void>;
  isWindowOpen(conversationId: string, now: Date): Promise<boolean>;
  lastInboundAt?(conversationId: string): Promise<Date | null>;
  deliverContent(input: { conversationId: string; review: AlertReview; contactId: string; requestSeed: string }): Promise<DeliverResult>;
  /** Texto de aviso: la imagen de esta reseña no se ha podido generar (con el enlace para verla). */
  sendFailureNotice(input: { conversationId: string; review: AlertReview; contactId: string; requestSeed: string }): Promise<boolean>;
  hasNotifiedTemplate?(contactId: string): Promise<boolean>;
  countOutstanding(contactId: string): Promise<number>;
  sendTemplate(input: { conversationId: string; contactName: string | null; count: number; requestSeed: string }): Promise<TemplateResult>;
  log?: (message: string) => void;
}

/**
 * Segundo (y último) intento de las alertas cuya imagen falló con la ventana abierta. Si vuelve a fallar se deja
 * un AVISO por texto ("no se ha podido generar la alerta de esta reseña" + enlace) y la fila queda marcada
 * `image_failed_final`: no se reintenta más sola (sigue pendiente para "Ver alerta"). Si entretanto la ventana se
 * cerró, se avisa con la plantilla (una sola por contacto).
 */
export async function retryFailedImageAlerts(deps: ImageRetryDeps): Promise<ImageRetryResult> {
  const now = deps.now ?? (() => new Date());
  const result: ImageRetryResult = { retried: 0, delivered: 0, noticed: 0, templated: 0 };

  const alerts = await deps.listImageFailed(new Date(now().getTime() - IMAGE_RETRY_AFTER_MS));
  for (const alert of alerts) {
    if (!(await deps.claim(alert.id))) continue;
    result.retried += 1;
    const seed = seedOf(alert.resenaId, alert.contactId, alert.id);

    try {
      const review = await deps.loadReview(alert.resenaId);
      if (!review) {
        await deps.update(alert.id, { status: "failed", errorCode: "review_not_found" });
        continue;
      }

      if (!(await deps.isWindowOpen(alert.conversationId, now()))) {
        // La ventana se cerró mientras tanto: ahora sí corresponde la plantilla (una sola por contacto).
        await deps.update(alert.id, { status: "pending", errorReason: "window_closed_at_retry" });
        if (!(await deps.hasNotifiedTemplate?.(alert.contactId))) {
          const count = Math.max(1, await deps.countOutstanding(alert.contactId));
          const template = await deps.sendTemplate({ conversationId: alert.conversationId, contactName: alert.contactName, count, requestSeed: seed });
          if (template.status === "sent") {
            await deps.update(alert.id, { status: "notified", via: "template", templateWamid: template.wamid, notifiedAt: now() });
            result.templated += 1;
          }
        }
        continue;
      }

      const delivered = await deps.deliverContent({ conversationId: alert.conversationId, review, contactId: alert.contactId, requestSeed: seed });
      if (delivered.status === "sent") {
        await deps.update(alert.id, { status: "delivered", via: "direct", deliveredAt: now(), errorCode: null, errorReason: null });
        result.delivered += 1;
        continue;
      }
      if (delivered.status === "uncertain") {
        await deps.update(alert.id, { status: "failed", errorCode: delivered.code.slice(0, 40), errorReason: "uncertain" });
        continue;
      }

      // Falló otra vez: aviso al contacto y la fila queda cerrada para el reintento automático.
      deps.log?.(`[negative-alert] image_retry_failed resenaId=${review.resenaId} code=${delivered.code}`);
      const last = (await deps.lastInboundAt?.(alert.conversationId)) ?? null;
      const detail = last ? `last_inbound=${last.toISOString()};window_until=${new Date(last.getTime() + WINDOW_MS).toISOString()}` : "last_inbound=unknown";
      const noticed = await deps.sendFailureNotice({ conversationId: alert.conversationId, review, contactId: alert.contactId, requestSeed: seed });
      await deps.update(alert.id, {
        status: "pending",
        errorCode: delivered.code.slice(0, 40),
        errorReason: `image_failed_final;${noticed ? "notice_sent" : "notice_failed"};${detail}`,
      });
      if (noticed) result.noticed += 1;
    } catch (error) {
      // Nunca se queda en `delivering`: vuelve a pendiente y cerrada para el reintento automático.
      await deps
        .update(alert.id, { status: "pending", errorCode: "exception", errorReason: `image_failed_final;${error instanceof Error ? error.name : "Error"}` })
        .catch(() => undefined);
      deps.log?.(`[negative-alert] image_retry_exception resenaId=${alert.resenaId}`);
    }
  }
  return result;
}

// Reenvío manual (página "Fallos de envío") ----------------------------------------------------------

/** Marca de la fila cuando el reenvío manual tampoco consigue entregar la alerta. */
export const MANUAL_RESEND_FAILED_PREFIX = "manual_resend_failed;";

export type ManualResendAlert = { id: string; resenaId: number; restauranteId: number; contactId: string; status: string };
export type ManualResendContact = { name: string | null; activated: boolean; alertsEnabled: boolean };

export type ManualResendResult =
  | { status: "delivered" }
  | { status: "template_sent" }
  /** Ventana cerrada y ya hay un aviso «Ver alerta» sin atender: llegará cuando lo pulse. */
  | { status: "waiting_template" }
  | { status: "not_found" }
  | { status: "not_resendable"; current: string }
  | { status: "busy" }
  | { status: "no_access" }
  | { status: "alerts_disabled" }
  | { status: "not_activated" }
  | { status: "failed"; code: string; uncertain: boolean };

export interface ManualResendDeps {
  now?: () => Date;
  loadAlert(alertId: string): Promise<ManualResendAlert | null>;
  loadContact(contactId: string): Promise<ManualResendContact | null>;
  /** Restaurantes accesibles HOY por el contacto (deny by default). */
  resolveRestaurantIds(contactId: string): Promise<number[]>;
  /** `pending|failed → delivering` atómico; `false` si otro proceso la tomó. */
  claim(alertId: string): Promise<boolean>;
  loadReview(resenaId: number): Promise<AlertReview | null>;
  update(alertId: string, patch: AlertPatch): Promise<void>;
  conversationFor(contactId: string): Promise<string>;
  isWindowOpen(conversationId: string, now: Date): Promise<boolean>;
  deliverContent(input: { conversationId: string; review: AlertReview; contactId: string; requestSeed: string }): Promise<DeliverResult>;
  hasNotifiedTemplate(contactId: string): Promise<boolean>;
  countOutstanding(contactId: string): Promise<number>;
  sendTemplate(input: { conversationId: string; contactName: string | null; count: number; requestSeed: string }): Promise<TemplateResult>;
  log?: (message: string) => void;
}

/** Estados desde los que se puede reenviar a mano: la alerta sigue sin llegar. */
const RESENDABLE = new Set(["pending", "failed"]);

/**
 * Reenvío manual de UNA alerta que no llegó (lo pide un super_admin desde "Fallos de envío"). Mismas reglas que
 * el flujo automático: permisos de HOY, interruptor de alertas, contacto activado, ventana de 24 h. Reutiliza la
 * semilla de envío de la alerta: lo que ya salió no se repite y un envío incierto no se reenvía a ciegas.
 *   · Ventana abierta → imagen + texto.
 *   · Ventana cerrada (o Meta lo confirma con 131047) → plantilla «Ver alerta» (una sola por contacto).
 */
export async function resendAlertManually(input: { alertId: string }, deps: ManualResendDeps): Promise<ManualResendResult> {
  const now = deps.now ?? (() => new Date());

  const alert = await deps.loadAlert(input.alertId);
  if (!alert) return { status: "not_found" };
  if (!RESENDABLE.has(alert.status)) return { status: "not_resendable", current: alert.status };

  const contact = await deps.loadContact(alert.contactId);
  if (!contact) return { status: "not_found" };
  if (!contact.alertsEnabled) return { status: "alerts_disabled" };
  if (!(await deps.resolveRestaurantIds(alert.contactId)).includes(alert.restauranteId)) return { status: "no_access" };
  if (!contact.activated) return { status: "not_activated" };

  if (!(await deps.claim(alert.id))) return { status: "busy" };
  const seed = seedOf(alert.resenaId, alert.contactId, alert.id);

  try {
    const review = await deps.loadReview(alert.resenaId);
    if (!review) {
      await deps.update(alert.id, { status: "failed", errorCode: "review_not_found", errorReason: null });
      return { status: "failed", code: "review_not_found", uncertain: false };
    }

    const conversationId = await deps.conversationFor(alert.contactId);
    let windowClosedCode: string | null = null;

    if (await deps.isWindowOpen(conversationId, now())) {
      const delivered = await deps.deliverContent({ conversationId, review, contactId: alert.contactId, requestSeed: seed });
      if (delivered.status === "sent") {
        await deps.update(alert.id, {
          status: "delivered",
          via: "direct",
          conversationId,
          deliveredAt: now(),
          errorCode: null,
          errorReason: null,
        });
        return { status: "delivered" };
      }
      if (delivered.status === "uncertain") {
        await deps.update(alert.id, { status: "failed", conversationId, errorCode: delivered.code.slice(0, 40), errorReason: "uncertain" });
        return { status: "failed", code: delivered.code, uncertain: true };
      }
      if (!WINDOW_CLOSED_CODES.has(delivered.code)) {
        await deps.update(alert.id, {
          status: "pending",
          conversationId,
          errorCode: delivered.code.slice(0, 40),
          errorReason: `${MANUAL_RESEND_FAILED_PREFIX}${now().toISOString()}`,
        });
        return { status: "failed", code: delivered.code, uncertain: false };
      }
      windowClosedCode = delivered.code;
    }

    // Ventana cerrada: solo cabe la plantilla, y solo una sin atender por contacto.
    if (await deps.hasNotifiedTemplate(alert.contactId)) {
      await deps.update(alert.id, {
        status: "pending",
        conversationId,
        errorCode: windowClosedCode,
        errorReason: "waiting_template",
      });
      return { status: "waiting_template" };
    }
    const count = Math.max(1, await deps.countOutstanding(alert.contactId));
    const template = await deps.sendTemplate({ conversationId, contactName: contact.name, count, requestSeed: seed });
    if (template.status === "sent") {
      await deps.update(alert.id, {
        status: "notified",
        via: "template",
        conversationId,
        templateWamid: template.wamid,
        notifiedAt: now(),
        errorCode: null,
        errorReason: null,
      });
      return { status: "template_sent" };
    }
    await deps.update(alert.id, { status: "pending", conversationId, errorCode: template.code.slice(0, 40), errorReason: "template" });
    return { status: "failed", code: template.code, uncertain: false };
  } catch (error) {
    // Nunca se queda en `delivering`.
    await deps
      .update(alert.id, {
        status: "pending",
        errorCode: "exception",
        errorReason: `${MANUAL_RESEND_FAILED_PREFIX}${error instanceof Error ? error.name : "Error"}`,
      })
      .catch(() => undefined);
    deps.log?.(`[negative-alert] manual_resend_exception alertId=${alert.id}`);
    return { status: "failed", code: "exception", uncertain: false };
  }
}
