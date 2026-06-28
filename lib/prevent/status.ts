import type { PreventStatus } from "./types";

export const PREVENT_STATUS_META: Record<
  PreventStatus,
  {
    label: string;
    pill: string;
    dot: string;
    cardEdge: string;
    summaryValue: string;
    summaryCard: string;
    metricAccent: string;
  }
> = {
  fuera_objetivo: {
    label: "Fuera de objetivo",
    pill: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
    dot: "bg-[var(--nexo-critical)]",
    cardEdge: "border-l-[var(--nexo-critical)]",
    summaryValue: "text-[var(--nexo-critical)]",
    summaryCard: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)]",
    metricAccent: "text-[var(--nexo-critical)]",
  },
  vigilancia: {
    label: "Vigilancia",
    pill: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]",
    dot: "bg-[var(--nexo-watch)]",
    cardEdge: "border-l-[var(--nexo-watch)]",
    summaryValue: "text-[var(--nexo-watch)]",
    summaryCard: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)]",
    metricAccent: "text-[var(--nexo-watch)]",
  },
  protegido: {
    label: "Protegido",
    pill: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]",
    dot: "bg-[var(--nexo-success)]",
    cardEdge: "border-l-[var(--nexo-success)]",
    summaryValue: "text-[var(--nexo-success)]",
    summaryCard: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)]",
    metricAccent: "text-[var(--nexo-success)]",
  },
};
