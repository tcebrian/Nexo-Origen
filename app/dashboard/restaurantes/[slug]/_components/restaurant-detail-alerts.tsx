import Link from "next/link";
import { CommentExcerpt } from "@/app/dashboard/_components/comment-excerpt";
import { formatRelativeTime } from "@/lib/restaurants/detail-helpers";
import { getReviewHref } from "@/lib/text/excerpt";
import type { ActivityEventType, RestaurantDetail } from "@/lib/restaurants/types";
import { detailChartCard, detailKicker, detailSection } from "./detail-health-styles";

type RestaurantDetailAlertsProps = {
  detail: RestaurantDetail;
};

const eventStyles: Record<
  ActivityEventType,
  { border: string; bg: string; icon: string; iconColor: string }
> = {
  alert: {
    border: "border-[var(--nexo-critical-border)]",
    bg: "bg-[var(--nexo-critical-muted)]",
    iconColor: "text-[var(--nexo-critical)]",
    icon: "M12 9v4M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  },
  warning: {
    border: "border-[var(--nexo-watch-border)]",
    bg: "bg-[var(--nexo-watch-muted)]",
    iconColor: "text-[var(--nexo-watch)]",
    icon: "M12 9v4M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  },
  success: {
    border: "border-[var(--nexo-success-border)]",
    bg: "bg-[var(--nexo-success-muted)]",
    iconColor: "text-[var(--nexo-success)]",
    icon: "M9 12l2 2 4-4 M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  },
  info: {
    border: "border-[var(--nexo-accent-border)]",
    bg: "bg-[var(--nexo-accent-muted)]",
    iconColor: "text-[var(--nexo-accent)]",
    icon: "M12 16v-4M12 8h.01 M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  },
};

export function RestaurantDetailAlerts({ detail }: RestaurantDetailAlertsProps) {
  return (
    <section className={detailChartCard}>
      <div className={`${detailSection} flex flex-1 flex-col`}>
        <div className="flex flex-col gap-4 border-b border-[var(--nexo-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={detailKicker}>Alertas y actividad</p>
            <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">
              {detail.activeAlerts > 0
                ? `${detail.activeAlerts} alerta${detail.activeAlerts === 1 ? "" : "s"} activa${detail.activeAlerts === 1 ? "" : "s"} en el periodo`
                : "Sin alertas críticas en el periodo"}
            </p>
          </div>
          <Link
            href={detail.alertsHref}
            className="text-[12px] font-medium text-[var(--nexo-accent)] transition hover:text-[var(--nexo-accent-hover)]"
          >
            Centro de alertas →
          </Link>
        </div>

        <div className="mt-6 flex-1 space-y-3">
          {detail.recentActivity.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-6 py-12 text-center">
              <p className="text-[14px] font-medium text-[var(--nexo-text)]">Sin actividad crítica</p>
              <p className="mt-2 text-[12px] text-[var(--nexo-text-secondary)]">
                No hay incidencias recientes que requieran intervención inmediata.
              </p>
            </div>
          ) : (
            detail.recentActivity.map((event) => {
              const style = eventStyles[event.type];
              return (
                <div
                  key={event.id}
                  className="flex gap-4 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-4 transition hover:border-[var(--nexo-border-strong)]"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${style.border} ${style.bg}`}
                  >
                    <svg
                      className={`h-4 w-4 ${style.iconColor}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d={style.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-[var(--nexo-text-tertiary)]">
                      {formatRelativeTime(event.occurredAt)}
                    </p>
                    {event.reviewId ? (
                      <CommentExcerpt
                        text={event.description}
                        reviewHref={getReviewHref(event.reviewId)}
                        maxLength={120}
                        className="mt-1 text-[14px] leading-relaxed text-[var(--nexo-text)]"
                      />
                    ) : (
                      <p className="mt-1 text-[14px] leading-relaxed text-[var(--nexo-text)]">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
