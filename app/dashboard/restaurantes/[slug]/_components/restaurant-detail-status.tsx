import type { RestaurantDetail } from "@/lib/restaurants/types";
import { detailMetricLabel, detailMetricValue, detailSection, detailShell, healthStyles } from "./detail-health-styles";

type RestaurantDetailStatusProps = {
  detail: RestaurantDetail;
};

export function RestaurantDetailStatus({ detail }: RestaurantDetailStatusProps) {
  const health = healthStyles[detail.healthStatus];

  const metrics = [
    {
      label: "Estado",
      value: detail.healthStatusLabel,
      isStatus: true,
    },
    {
      label: "Media actual",
      value: detail.currentMedia.toFixed(1),
      isStatus: false,
    },
    {
      label: "Objetivo",
      value: detail.targetMedia.toFixed(1),
      isStatus: false,
    },
    {
      label: "Alertas activas",
      value: String(detail.activeAlerts),
      isStatus: false,
      alert: detail.activeAlerts > 0,
    },
  ];

  return (
    <section className={`${detailShell} mb-8`}>
      <div className={detailSection}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
          Estado actual
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className={detailMetricLabel}>{metric.label}</p>
              {metric.isStatus ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${health.dot}`} />
                  <p className={`text-[28px] font-light tracking-tight ${health.text}`}>
                    {metric.value}
                  </p>
                </div>
              ) : (
                <p
                  className={`${detailMetricValue} ${
                    metric.alert ? "text-red-300" : ""
                  }`}
                >
                  {metric.value}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
