import type { DeliveryStatus, MessageStatus } from "@/lib/conversations/types";

/**
 * Reglas de transición del estado de un mensaje SALIENTE según los estados que
 * notifica Meta. Función pura: la usa la persistencia para construir una única
 * actualización condicional (`WHERE status IN (...)`) y los tests para fijar la
 * semántica.
 *
 * Los webhooks de estado pueden llegar repetidos, tarde o desordenados, así que
 * el estado solo avanza:
 *
 *   pending(0) → sent(1) → delivered(2) → read(3)
 *
 *  - `sent`: solo desde `pending`. Nunca degrada `delivered`/`read`/`failed`.
 *  - `delivered`: desde `pending`, `sent` o `failed`; nunca degrada `read`.
 *  - `read`: desde cualquier estado de entrega anterior (también `failed`).
 *  - `failed`: solo desde `pending` o `sent` (Meta confirma el fallo). Nunca
 *    pisa `delivered`/`read`: una confirmación de entrega no se "des-entrega",
 *    y si llegara un `failed` tardío sería menos fiable que el acuse. Un
 *    `delivered`/`read` posterior sí corrige un `failed` previo (es la prueba
 *    positiva de que llegó).
 *  - `deleted`: la persona eliminó el mensaje. Solo tiene sentido sobre un
 *    mensaje ya aceptado (`sent`/`delivered`/`read`); es terminal: después no se
 *    aplica ningún otro estado. Nunca sobre `pending` ni `failed`.
 *  - El mismo estado repetido no cambia nada (idempotencia).
 */
const ALLOWED_BEFORE: Record<DeliveryStatus, readonly MessageStatus[]> = {
  sent: ["pending"],
  delivered: ["pending", "sent", "failed"],
  read: ["pending", "sent", "delivered", "failed"],
  failed: ["pending", "sent"],
  deleted: ["sent", "delivered", "read"],
};

/** Estados actuales desde los que `incoming` puede aplicarse. */
export function statusesAllowedBefore(incoming: DeliveryStatus): readonly MessageStatus[] {
  return ALLOWED_BEFORE[incoming];
}

/** ¿Debe un mensaje en estado `current` pasar a `incoming`? */
export function shouldApplyStatus(current: MessageStatus, incoming: DeliveryStatus): boolean {
  return ALLOWED_BEFORE[incoming].includes(current);
}
