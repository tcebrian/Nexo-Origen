import type { RestaurantDetail } from "@/lib/restaurants/types";
import { detailKicker, detailSection, detailShell } from "./detail-health-styles";

type RestaurantDetailEvolutionProps = {
  detail: RestaurantDetail;
};

function buildChartPath(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return "";

  const min = Math.min(...values) - 0.15;
  const max = Math.max(...values) + 0.15;
  const range = max - min || 1;
  const stepX = (width - padding * 2) / Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, padding: number) {
  const line = buildChartPath(values, width, height, padding);
  if (!line) return "";

  const lastX = padding + (values.length - 1) * ((width - padding * 2) / Math.max(values.length - 1, 1));
  return `${line} L${lastX.toFixed(1)},${height - padding} L${padding},${height - padding} Z`;
}

export function RestaurantDetailEvolution({ detail }: RestaurantDetailEvolutionProps) {
  const values = detail.chartValues;
  const labels = detail.chartLabels;
  const width = 640;
  const height = 200;
  const padding = 24;
  const linePath = buildChartPath(values, width, height, padding);
  const areaPath = buildAreaPath(values, width, height, padding);
  const latest = values[values.length - 1];
  const first = values[0];
  const delta = latest && first ? latest - first : 0;

  return (
    <section className={`${detailShell} mb-8`}>
      <div className={detailSection}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={detailKicker}>Evolución</p>
            <p className="mt-2 text-[13px] text-gray-500">Media de reputación en el periodo seleccionado</p>
          </div>
          {latest !== undefined && (
            <div className="text-right">
              <p className="font-mono text-[28px] font-light tabular-nums text-white">
                {latest.toFixed(1)}
              </p>
              <p
                className={`mt-1 text-[12px] font-medium ${
                  delta >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2)} en el periodo
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 px-2 py-4">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label="Gráfico de evolución de la media"
          >
            <defs>
              <linearGradient id="evolutionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.28)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0)" />
              </linearGradient>
            </defs>
            {areaPath ? <path d={areaPath} fill="url(#evolutionFill)" /> : null}
            {linePath ? (
              <path
                d={linePath}
                fill="none"
                stroke="rgba(167,139,250,0.9)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>

          {labels.length > 0 && (
            <div className="mt-2 flex justify-between px-4 text-[10px] text-gray-600">
              <span>{labels[0]}</span>
              <span>{labels[labels.length - 1]}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
