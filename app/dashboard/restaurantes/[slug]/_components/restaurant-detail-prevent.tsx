import Link from "next/link";
import type { RestaurantDetail } from "@/lib/restaurants/types";
import { btnPrimary } from "../../_components/ui/restaurantes-styles";
import { detailKicker, detailMetricCard, detailSection, detailShell, healthStyles } from "./detail-health-styles";

type RestaurantDetailPreventProps = {
  detail: RestaurantDetail;
};

export function RestaurantDetailPrevent({ detail }: RestaurantDetailPreventProps) {
  const health = healthStyles[detail.healthStatus];

  return (
    <section className={`${detailShell} border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-transparent`}>
      <div className={detailSection}>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className={detailKicker}>Nexo Prevent</p>
            <p className="mt-2 max-w-xl text-[13px] text-gray-500">
              Sistema de protección reputacional · nivel de riesgo y recomendaciones preventivas.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className={detailMetricCard}>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">Estado</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${health.dot}`} />
                  <p className={`text-lg font-medium ${health.text}`}>{detail.statusLabel}</p>
                </div>
              </div>

              <div className={detailMetricCard}>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">Protección</p>
                <p className="mt-2 font-mono text-[24px] font-light tabular-nums text-white">
                  {detail.protectionLevel}%
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${health.bar}`}
                    style={{ width: `${detail.protectionLevel}%` }}
                  />
                </div>
              </div>

              <div className={detailMetricCard}>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">Media global</p>
                <p className="mt-2 font-mono text-[24px] font-light tabular-nums text-white">
                  {detail.currentMedia.toFixed(1)}
                </p>
                <p className="mt-1 text-[11px] text-gray-600">Objetivo {detail.targetMedia.toFixed(1)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">
                Recomendación preventiva
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-300">
                {detail.preventRecommendation}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end lg:pt-8">
            <Link href={detail.preventHref} className={btnPrimary}>
              Abrir Nexo Prevent
            </Link>
            {detail.negativeBuffer > 0 && (
              <p className="max-w-[240px] text-right text-[12px] leading-relaxed text-gray-500">
                Margen de seguridad:{" "}
                <span className="font-medium text-emerald-300">{detail.negativeBuffer}</span> reseñas
                negativas absorbibles.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
