import type { RestaurantDetail } from "@/lib/restaurants/types";
import { detailKicker, detailSection, detailShell, healthStyles } from "./detail-health-styles";

type RestaurantDetailIssuesProps = {
  detail: RestaurantDetail;
};

export function RestaurantDetailIssues({ detail }: RestaurantDetailIssuesProps) {
  const maxIntensity = Math.max(...detail.detectedIssues.map((i) => i.intensity), 1);

  return (
    <section className={`${detailShell} h-full`}>
      <div className={detailSection}>
        <p className={detailKicker}>Motivos detectados</p>

        <div className="mt-8 space-y-6">
          {detail.detectedIssues.map((issue) => {
            const width = Math.round((issue.intensity / maxIntensity) * 100);
            const barTone =
              issue.intensity >= maxIntensity * 0.7
                ? healthStyles.risk.bar
                : issue.intensity >= maxIntensity * 0.45
                  ? healthStyles.watch.bar
                  : "bg-white/25";

            return (
              <div key={issue.id}>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-gray-300">{issue.label}</p>
                  <span className="font-mono text-[11px] tabular-nums text-gray-600">
                    {issue.intensity}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barTone}`}
                    style={{ width: `${width}%`, opacity: 0.85 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
