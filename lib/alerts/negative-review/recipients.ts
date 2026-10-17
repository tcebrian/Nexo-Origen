import type { AlertRecipient } from "./orchestrator";

/**
 * Destinatarios de una alerta negativa. Función pura: dos condiciones, ambas obligatorias.
 *
 *   1. El contacto activó el interruptor "Reseñas negativas" (`conv_contactos.recibir_alertas_negativas`).
 *   2. El restaurante está dentro de lo que el contacto puede consultar HOY (`access`, resuelto SOLO desde
 *      conv_contacto_empresas / conv_contacto_restaurantes, con `todos_restaurantes` dinámico).
 *
 * El interruptor NUNCA concede acceso: solo decide si, además de tener acceso, quiere recibir la alerta.
 * Sin interruptor activo no se reserva ni se envía nada, ni siquiera una alerta pendiente.
 */

export type AlertContactRow = {
  id: string;
  name: string | null;
  /** `whatsapp_activated_at` informado. */
  activated: boolean;
  /** `recibir_alertas_negativas`. */
  alertsEnabled: boolean;
};

export function selectAlertRecipients(input: {
  restaurantId: number;
  contacts: readonly AlertContactRow[];
  /** Restaurantes accesibles HOY por contacto (deny by default: ausente = ninguno). */
  access: ReadonlyMap<string, readonly number[]>;
}): AlertRecipient[] {
  return input.contacts
    .filter((contact) => contact.alertsEnabled === true)
    .filter((contact) => input.access.get(contact.id)?.includes(input.restaurantId) === true)
    .map((contact) => ({ contactId: contact.id, name: contact.name, activated: contact.activated }));
}
