import "server-only";

import { toDateKey } from "@/lib/dates/period";
import type { UserScope } from "@/lib/auth/types";
import type { PeriodData } from "./period-types";

/** Carga periodo en servidor con scope opcional. */
export async function loadPeriodDataServer(
  start: Date,
  end: Date,
  scope?: UserScope
): Promise<PeriodData> {
  const { getPeriodData } = await import("./period-stats");
  return getPeriodData(toDateKey(start), toDateKey(end), scope);
}
