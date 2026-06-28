import {
  formatImpactSummary,
  impactToneClass,
  type ImpactSnapshot,
} from "@/lib/reviews/impact-display";

type MediaImpactDisplayProps = {
  snapshot: ImpactSnapshot;
  decimals?: number;
  align?: "left" | "right";
  compact?: boolean;
};

export function MediaImpactDisplay({
  snapshot,
  decimals = 1,
  align = "left",
  compact = false,
}: MediaImpactDisplayProps) {
  const impact = formatImpactSummary(snapshot, decimals);
  const alignment = align === "right" ? "text-right" : "text-left";

  if (compact) {
    return (
      <div className={alignment}>
        <p className="font-mono text-sm font-medium tabular-nums tracking-tight text-gray-100">
          {impact.headline}
        </p>
        <p className={`mt-0.5 text-xs font-medium tabular-nums ${impactToneClass(impact.tone)}`}>
          {impact.delta}
        </p>
      </div>
    );
  }

  return (
    <div className={alignment}>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-gray-500">
        Media del local
      </p>
      <p className="mt-1 font-mono text-sm font-medium tabular-nums tracking-tight text-gray-100">
        {impact.headline}
      </p>
      <p className={`mt-0.5 text-xs leading-snug ${impactToneClass(impact.tone)}`}>
        {impact.subline}
      </p>
    </div>
  );
}
