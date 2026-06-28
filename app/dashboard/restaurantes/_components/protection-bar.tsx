import { getProtectionTone } from "@/lib/restaurants/metrics";
import type { OperationalStatus } from "@/lib/restaurants/types";
import { protectionSegment, protectionSegmentEmpty } from "./ui/restaurantes-styles";

const SEGMENTS = 12;

type ProtectionBarProps = {
  level: number;
  status?: OperationalStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export function ProtectionBar({
  level,
  status,
  showLabel = true,
  size = "md",
}: ProtectionBarProps) {
  const tone = status ?? getProtectionTone(level);
  const fillClass = protectionSegment[tone];
  const filledCount = Math.round((Math.min(100, Math.max(0, level)) / 100) * SEGMENTS);
  const gap = size === "sm" ? "gap-[3px]" : "gap-1";
  const segmentH = size === "sm" ? "h-2" : "h-2.5";

  return (
    <div>
      {showLabel && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">
            Protección
          </span>
          <span className="font-mono text-[13px] font-medium tabular-nums text-gray-200">
            {level}%
          </span>
        </div>
      )}
      <div className={`flex ${gap}`} aria-hidden>
        {Array.from({ length: SEGMENTS }).map((_, index) => (
          <div
            key={index}
            className={`flex-1 rounded-[3px] ${segmentH} ${
              index < filledCount ? fillClass : protectionSegmentEmpty
            }`}
          />
        ))}
      </div>
    </div>
  );
}
