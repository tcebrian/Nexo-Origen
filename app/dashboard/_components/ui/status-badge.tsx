import {
  fromAlertStatus,
  fromOperationalStatus,
  fromPreventStatus,
  UNIFIED_STATUS_META,
  type UnifiedStatus,
} from "@/lib/status/unified";
import type { AlertStatus } from "@/lib/alerts/types";
import type { OperationalStatus } from "@/lib/types";
import type { PreventStatus } from "@/lib/prevent/types";
import { metricPill } from "./nexo-styles";

type StatusBadgeProps = {
  status: UnifiedStatus | OperationalStatus | AlertStatus | PreventStatus;
  source?: "unified" | "operational" | "alert" | "prevent";
  className?: string;
};

function resolveUnified(
  status: StatusBadgeProps["status"],
  source: StatusBadgeProps["source"]
): UnifiedStatus {
  if (source === "operational") return fromOperationalStatus(status as OperationalStatus);
  if (source === "alert") return fromAlertStatus(status as AlertStatus);
  if (source === "prevent") return fromPreventStatus(status as PreventStatus);
  return status as UnifiedStatus;
}

export function StatusBadge({ status, source = "unified", className = "" }: StatusBadgeProps) {
  const unified = resolveUnified(status, source);
  const meta = UNIFIED_STATUS_META[unified];

  return (
    <span className={`${metricPill} ${meta.pill} ${className}`}>{meta.label}</span>
  );
}

export function StatusDot({ status, source = "unified" }: Omit<StatusBadgeProps, "className">) {
  const unified = resolveUnified(status, source);
  const meta = UNIFIED_STATUS_META[unified];
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />;
}
