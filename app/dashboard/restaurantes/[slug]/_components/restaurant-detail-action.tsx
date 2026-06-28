import { getReputationOutlook } from "@/lib/restaurants/reputation-outlook";
import type { RestaurantDetail } from "@/lib/restaurants/types";
import { detailSection, detailShell, healthStyles } from "./detail-health-styles";

type RestaurantDetailActionProps = {
  detail: RestaurantDetail;
};

export function RestaurantDetailAction({ detail }: RestaurantDetailActionProps) {
  const health = healthStyles[detail.healthStatus];
  const outlook = getReputationOutlook(
    detail.currentMedia,
    detail.totalReviews,
    detail.status,
    detail.targetMedia
  );
  const needsAction =
    detail.status !== "on_target" ||
    detail.activeAlerts > 0 ||
    outlook.positivesNeeded > 0;

  return (
    <section
      className={`${detailShell} mb-8 border ${health.border} bg-gradient-to-br ${health.glow}`}
    >
      <div className={detailSection}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
              Acción recomendada
            </p>
            <p
              className={`mt-4 max-w-3xl text-[20px] font-light leading-snug tracking-tight lg:text-[24px] ${
                needsAction ? health.text : "text-emerald-200"
              }`}
            >
              {detail.primaryAction}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {detail.activeAlerts > 0 && (
              <span className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300">
                {detail.activeAlerts} alerta{detail.activeAlerts === 1 ? "" : "s"}
              </span>
            )}
            {outlook.positivesNeeded > 0 && (
              <span className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300">
                +{outlook.positivesNeeded} reseñas
              </span>
            )}
            {outlook.negativesTolerance > 0 && (
              <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
                Margen {outlook.negativesTolerance}
              </span>
            )}
            {!needsAction && (
              <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
                En objetivo
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
