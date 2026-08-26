import "server-only";

import { toDateKey } from "@/lib/dates/period";
import type { UserScope } from "@/lib/auth/types";
import { getPeriodData } from "@/lib/supabase/period-stats";
import { buildNetworkSummaryReport } from "./build";
import { NETWORK_REPORT_GROUPS, type NetworkReportGroupId } from "./brand-groups";
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
  return buildNetworkSummaryReport(group, data.activeKpiRows, data.resenas, data.analisisByResenaId, period);
}
