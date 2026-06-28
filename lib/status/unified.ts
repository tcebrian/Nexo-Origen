import type { OperationalStatus } from "@/lib/types";
import type { AlertStatus } from "@/lib/alerts/types";
import type { PreventStatus } from "@/lib/prevent/types";

export type UnifiedStatus =
  | "protegido"
  | "vigilancia"
  | "riesgo"
  | "critico"
  | "resuelta";

export const UNIFIED_STATUS_META: Record<
  UnifiedStatus,
  {
    label: string;
    executiveLabel: string;
    pill: string;
    dot: string;
    cardEdge: string;
    summaryValue: string;
    summaryCard: string;
  }
> = {
  protegido: {
    label: "En objetivo",
    executiveLabel: "Estable",
    pill: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]",
    dot: "bg-[var(--nexo-success)]",
    cardEdge: "border-l-[var(--nexo-success)]",
    summaryValue: "text-[var(--nexo-success)]",
    summaryCard: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)]",
  },
  vigilancia: {
    label: "Vigilancia",
    executiveLabel: "Vigilancia",
    pill: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]",
    dot: "bg-[var(--nexo-watch)]",
    cardEdge: "border-l-[var(--nexo-watch)]",
    summaryValue: "text-[var(--nexo-watch)]",
    summaryCard: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)]",
  },
  riesgo: {
    label: "Riesgo alto",
    executiveLabel: "Crítico",
    pill: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
    dot: "bg-[var(--nexo-critical)]",
    cardEdge: "border-l-[var(--nexo-critical)]",
    summaryValue: "text-[var(--nexo-critical)]",
    summaryCard: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)]",
  },
  critico: {
    label: "Crítico",
    executiveLabel: "Crítico",
    pill: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
    dot: "bg-[var(--nexo-critical)]",
    cardEdge: "border-l-[var(--nexo-critical)]",
    summaryValue: "text-[var(--nexo-critical)]",
    summaryCard: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)]",
  },
  resuelta: {
    label: "Resuelta",
    executiveLabel: "Resuelta",
    pill: "border-[var(--nexo-border)] bg-[var(--nexo-inset)] text-[var(--nexo-text-secondary)]",
    dot: "bg-[var(--nexo-text-tertiary)]",
    cardEdge: "border-l-[var(--nexo-border-strong)]",
    summaryValue: "text-[var(--nexo-text-secondary)]",
    summaryCard: "border-[var(--nexo-border)] bg-[var(--nexo-inset)]",
  },
};

export function fromOperationalStatus(status: OperationalStatus): UnifiedStatus {
  if (status === "on_target") return "protegido";
  if (status === "watch") return "vigilancia";
  return "riesgo";
}

export function fromAlertStatus(status: AlertStatus): UnifiedStatus {
  if (status === "critico") return "critico";
  if (status === "seguimiento") return "vigilancia";
  if (status === "resuelto") return "resuelta";
  return "protegido";
}

export function fromPreventStatus(status: PreventStatus): UnifiedStatus {
  if (status === "protegido") return "protegido";
  if (status === "vigilancia") return "vigilancia";
  return "riesgo";
}

export const REPUTATION_TARGET = 4.4;
