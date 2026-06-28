export function mediaTrendFromChange(change: number): "up" | "down" | "flat" {
  if (Math.abs(change) < 0.02) return "flat";
  return change > 0 ? "up" : "down";
}
