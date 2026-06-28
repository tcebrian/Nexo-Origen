import { computeNetworkProtectionPercent } from "./calculate";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { PreventRecord, PreventNetworkSummary, PreventStatus, PreventView, PreventWeeklySummary } from "./types";

export type PreventFilters = {
  brand: "todas" | BrandId;
};

export type { BrandId };

const STATUS_ORDER: Record<PreventStatus, number> = {
  fuera_objetivo: 0,
  vigilancia: 1,
  protegido: 2,
};

export function filterPreventRecords(records: PreventRecord[], filters: PreventFilters) {
  if (filters.brand === "todas") return records;
  return records.filter((r) => r.brand === filters.brand);
}

function sortOutsideGoal(a: PreventRecord, b: PreventRecord) {
  return b.positivesNeeded - a.positivesNeeded || a.currentMedia - b.currentMedia;
}

function sortWatch(a: PreventRecord, b: PreventRecord) {
  return a.negativesTolerance - b.negativesTolerance || a.currentMedia - b.currentMedia;
}

function sortProtected(a: PreventRecord, b: PreventRecord) {
  return b.negativesTolerance - a.negativesTolerance || b.currentMedia - a.currentMedia;
}

export function buildPreventView(records: PreventRecord[]): PreventView {
  const outsideGoal = records
    .filter((r) => r.status === "fuera_objetivo")
    .sort(sortOutsideGoal);

  const watch = records.filter((r) => r.status === "vigilancia").sort(sortWatch);

  const protectedList = records
    .filter((r) => r.status === "protegido")
    .sort(sortProtected);

  const summary: PreventNetworkSummary = {
    protectedCount: protectedList.length,
    watchCount: watch.length,
    outsideGoalCount: outsideGoal.length,
    networkProtectionPercent: computeNetworkProtectionPercent(records),
    totalPositivesNeeded: outsideGoal.reduce((sum, record) => sum + record.positivesNeeded, 0),
    totalNegativesBuffer: records
      .filter((record) => record.currentMedia >= record.targetMedia)
      .reduce((sum, record) => sum + record.negativesTolerance, 0),
  };

  const weekly: PreventWeeklySummary = {
    positivesNeededNetwork: summary.totalPositivesNeeded,
    negativesBufferNetwork: summary.totalNegativesBuffer,
    protectedCount: protectedList.length,
    atRiskCount: outsideGoal.length + watch.length,
  };

  return {
    summary,
    weekly,
    outsideGoal,
    watch,
    protected: protectedList,
  };
}

/** Orden global: fuera → vigilancia → protegidos */
export function sortPreventRecords(records: PreventRecord[]): PreventRecord[] {
  return [...records].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (a.status === "fuera_objetivo") return sortOutsideGoal(a, b);
    if (a.status === "vigilancia") return sortWatch(a, b);
    return sortProtected(a, b);
  });
}
