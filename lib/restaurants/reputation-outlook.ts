import {
  computeNegativesTolerance,
  computePositivesNeeded,
  REPUTATION_TARGET,
} from "@/lib/prevent/calculate";
import type { OperationalStatus } from "./types";

export type ActionPriority = "alta" | "media" | "baja";

export type ReputationOutlook = {
  positivesNeeded: number;
  negativesTolerance: number;
  actionPriority: ActionPriority;
};

/**
 * Márgenes reputacionales coherentes: un local por debajo del objetivo
 * necesita positivas (tolerancia negativa = 0); solo por encima del objetivo
 * puede absorber negativas sin perder la meta.
 */
export function getReputationOutlook(
  currentMedia: number,
  reviewCount: number,
  status: OperationalStatus,
  target = REPUTATION_TARGET
): ReputationOutlook {
  const rawPositives = computePositivesNeeded(currentMedia, reviewCount, target);
  const rawNegatives = computeNegativesTolerance(currentMedia, reviewCount, target);

  const positivesNeeded = rawPositives > 0 ? rawPositives : 0;
  const negativesTolerance = rawPositives > 0 ? 0 : rawNegatives;

  return {
    positivesNeeded,
    negativesTolerance,
    actionPriority: resolveActionPriority(status, positivesNeeded, negativesTolerance),
  };
}

function resolveActionPriority(
  status: OperationalStatus,
  positivesNeeded: number,
  negativesTolerance: number
): ActionPriority {
  if (positivesNeeded > 0) {
    return status === "critical" ? "alta" : "media";
  }
  if (negativesTolerance <= 4 && status !== "on_target") {
    return "media";
  }
  return "baja";
}

export function formatPositivesNeeded(value: number): string {
  return value > 0 ? `+${value}` : "0";
}

export function formatNegativesTolerance(value: number): string {
  return String(value);
}

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const ACTION_PRIORITY_CLASS: Record<ActionPriority, string> = {
  alta: "text-[var(--nexo-critical)]",
  media: "text-[var(--nexo-watch)]",
  baja: "text-[var(--nexo-text-tertiary)]",
};
