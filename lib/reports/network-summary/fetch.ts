import "server-only";

import { toDateKey } from "@/lib/dates/period";
import type { UserScope } from "@/lib/auth/types";
import { getPeriodData } from "@/lib/supabase/period-stats";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";
import { fetchCanonicalMotiveBreakdown } from "@/lib/supabase/reputation-motives.server";
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
  const brandIdSet = new Set(group.brandIds);

  const groupRows = data.activeKpiRows
    .filter((row) => brandIdSet.has(marcaToBrandId(row.marca)))
    .filter((row) => !group.restaurantFilter || group.restaurantFilter(row));

  const restaurantIds = groupRows.map((row) => row.restaurante_id);

  const [metricRows, motiveRows] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(startKey, endKey, restaurantIds),
    fetchCanonicalMotiveBreakdown(startKey, endKey, restaurantIds),
  ]);

  return buildNetworkSummaryReport(
    group,
    data.activeKpiRows,
    metricRows,
    motiveRows,
    period
  );
}
