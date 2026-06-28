import type { DateRange } from "./types";

export function getDaysBetween(range: DateRange): number {
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
}
