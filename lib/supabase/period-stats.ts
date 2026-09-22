import { toDateKey } from "@/lib/dates/period";
import { getCanonicalReputationPeriod } from "@/lib/reputation/canonical-metrics.server";
import type { UserScope } from "@/lib/auth/types";
import type { LoadSnapshotOptions } from "@/lib/dashboard-data";
import type { PeriodData } from "./period-types";

export type {
  PeriodAggregates,
  PeriodData,
  PeriodDataSource,
  RestaurantPeriodMetrics,
} from "./period-types";

/**
 * Compatibility entry point used by the dashboard, reports and repositories.
 * All numeric reputation metrics are delegated to the canonical Nexo calculator.
 */
export async function getPeriodData(
  startKey: string,
  endKey: string,
  scope?: UserScope,
  options?: LoadSnapshotOptions
): Promise<PeriodData> {
  return getCanonicalReputationPeriod(startKey, endKey, scope, options);
}

export { toDateKey };
