import "server-only";

import { toDateKey } from "@/lib/dates/period";
import type { UserScope } from "@/lib/auth/types";
import { getPeriodData } from "@/lib/supabase/period-stats";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import { categoriaMotivoLabel } from "@/lib/supabase/resena-motivos";
import {
  extractCanonicalNetworkAggregate,
  fetchSupabaseCanonicalMotives,
  fetchSupabaseCanonicalReputationMetrics,
} from "@/lib/supabase/reputation-metrics.server";
import { buildNetworkSummaryReport } from "./build";
import {
  NETWORK_REPORT_GROUPS,
  type NetworkReportGroupId,
} from "./brand-groups";
import type { NetworkSummaryData } from "./types";

export async function fetchNetworkSummaryReport(
  groupId: NetworkReportGroupId,
  period: { start: Date; end: Date },
  scope?: UserScope
): Promise<NetworkSummaryData> {
  const startKey = toDateKey(period.start);
  const endKey = toDateKey(period.end);
  const data = await getPeriodData(startKey, endKey, scope);
  const group = NETWORK_REPORT_GROUPS[groupId];
  const brandIds = new Set(group.brandIds);

  const groupRows = data.activeKpiRows
    .filter((row) => brandIds.has(marcaToBrandId(row.marca)))
    .filter((row) => !group.restaurantFilter || group.restaurantFilter(row));

  const restaurantIds = groupRows.map((row) => row.restaurante_id);

  const [metricRows, motiveRows, motiveEntries] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(startKey, endKey, restaurantIds),
    fetchSupabaseCanonicalMotives(startKey, endKey, restaurantIds),
    Promise.all(
      restaurantIds.map(async (restaurantId) => {
        const motives = await fetchSupabaseCanonicalMotives(
          startKey,
          endKey,
          [restaurantId]
        );
        return [
          restaurantId,
          motives[0] ? categoriaMotivoLabel(motives[0].categoria) : null,
        ] as const;
      })
    ),
  ]);

  const topMotiveByRestaurant = new Map<number, string>();
  for (const [restaurantId, label] of motiveEntries) {
    if (label) topMotiveByRestaurant.set(restaurantId, label);
  }

  return buildNetworkSummaryReport(
    group,
    data.activeKpiRows,
    period,
    extractCanonicalNetworkAggregate(metricRows, restaurantIds.length),
    motiveRows,
    topMotiveByRestaurant
  );
}
