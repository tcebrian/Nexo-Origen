import { formatMediaRange } from "@/lib/reviews/impact-display";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { AlertStatus, RestaurantAlert } from "./types";

/** Colores semánticos discretos — paleta premium atenuada. */
export const STATUS_META: Record<
  AlertStatus,
  {
    label: string;
    radarLabel: string;
    pill: string;
    dot: string;
    priority: string;
    priorityBadge: string;
    cardEdge: string;
    summaryValue: string;
    summaryCard: string;
  }
> = {
  critico: {
    label: "Crítico",
    radarLabel: "Crítico",
    pill: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
    dot: "bg-[var(--nexo-critical)]",
    priority: "P1",
    priorityBadge:
      "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
    cardEdge: "border-l-[var(--nexo-critical)]",
    summaryValue: "text-[var(--nexo-critical)]",
    summaryCard: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)]",
  },
  seguimiento: {
    label: "Seguimiento",
    radarLabel: "Seguimiento",
    pill: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]",
    dot: "bg-[var(--nexo-watch)]",
    priority: "P2",
    priorityBadge:
      "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]",
    cardEdge: "border-l-[var(--nexo-watch)]",
    summaryValue: "text-[var(--nexo-watch)]",
    summaryCard: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)]",
  },
  resuelto: {
    label: "Resuelta",
    radarLabel: "Resuelta",
    pill: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]",
    dot: "bg-[var(--nexo-success)]",
    priority: "—",
    priorityBadge:
      "border-[var(--nexo-border)] bg-[var(--nexo-inset)] text-[var(--nexo-text-secondary)]",
    cardEdge: "border-l-[var(--nexo-success)]",
    summaryValue: "text-[var(--nexo-success)]",
    summaryCard: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)]",
  },
  optimo: {
    label: "Estable",
    radarLabel: "Estable",
    pill: "border-[var(--nexo-border)] bg-[var(--nexo-inset)] text-[var(--nexo-text-secondary)]",
    dot: "bg-[var(--nexo-text-tertiary)]",
    priority: "—",
    priorityBadge:
      "border-[var(--nexo-border)] bg-[var(--nexo-inset)] text-[var(--nexo-text-secondary)]",
    cardEdge: "border-l-[var(--nexo-border-strong)]",
    summaryValue: "text-[var(--nexo-text-secondary)]",
    summaryCard: "border-[var(--nexo-border)] bg-[var(--nexo-inset)]",
  },
};

export function getMediaDelta(alert: { mediaBefore: number | null; mediaAfter: number }) {
  if (alert.mediaBefore == null) return 0;
  return Number((alert.mediaAfter - alert.mediaBefore).toFixed(2));
}

export function formatImpactRange(alert: { mediaBefore: number | null; mediaAfter: number }) {
  return formatMediaRange(alert, 2);
}

export function formatDetectedDate(date: Date) {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeDetected(date: Date) {
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

export function isActionable(alert: RestaurantAlert) {
  return alert.status === "critico" || alert.status === "seguimiento";
}

export function getAlertRecommendation(alert: RestaurantAlert) {
  if (!alert.recommendation || alert.recommendation === IA_NO_DATA) return null;
  return alert.recommendation;
}
