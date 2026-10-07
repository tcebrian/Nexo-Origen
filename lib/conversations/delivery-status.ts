/**
 * Cómo se muestra el estado de entrega de un mensaje SALIENTE. Función pura:
 * decide el indicador (checks, etiqueta accesible y tono); la interfaz solo lo
 * dibuja. Los mensajes entrantes no llevan indicador.
 */

export type DeliveryIndicatorKind = "pending" | "sent" | "delivered" | "read" | "failed" | "deleted";

export type DeliveryIndicator = {
  kind: DeliveryIndicatorKind;
  /** Nº de checks (0 = reloj o aviso). */
  ticks: 0 | 1 | 2;
  /** Texto accesible; el visible es el icono salvo en los avisos. */
  label: string;
  /** Si la etiqueta debe verse como texto junto al icono. */
  showLabel: boolean;
  tone: "muted" | "read" | "warning" | "error";
};

/** Un `pending` más antiguo que esto ya no es "Enviando": no se pudo confirmar. */
export const PENDING_STALE_MS = 2 * 60 * 1000;

export function describeDeliveryStatus(status: string, pendingAgeMs = 0): DeliveryIndicator | null {
  switch (status) {
    case "pending":
      return pendingAgeMs > PENDING_STALE_MS
        ? { kind: "pending", ticks: 0, label: "Sin confirmar", showLabel: true, tone: "warning" }
        : { kind: "pending", ticks: 0, label: "Enviando", showLabel: false, tone: "muted" };
    case "sent":
      return { kind: "sent", ticks: 1, label: "Enviado", showLabel: false, tone: "muted" };
    case "delivered":
      return { kind: "delivered", ticks: 2, label: "Entregado", showLabel: false, tone: "muted" };
    case "read":
      return { kind: "read", ticks: 2, label: "Leído", showLabel: false, tone: "read" };
    case "failed":
      return { kind: "failed", ticks: 0, label: "No entregado", showLabel: true, tone: "error" };
    case "deleted":
      return { kind: "deleted", ticks: 0, label: "Eliminado", showLabel: true, tone: "muted" };
    default:
      return null;
  }
}
