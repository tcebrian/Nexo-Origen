import { formatRelativeTime } from "@/lib/restaurants/detail-helpers";
import type { RestaurantDetail } from "@/lib/restaurants/types";
import { detailKicker, detailSection, detailShell } from "./detail-health-styles";

type RestaurantDetailActivityProps = {
  detail: RestaurantDetail;
};

export function RestaurantDetailActivity({ detail }: RestaurantDetailActivityProps) {
  return (
    <section className={`${detailShell} h-full`}>
      <div className={detailSection}>
        <p className={detailKicker}>Actividad reciente</p>

        <div className="mt-8 space-y-0">
          {detail.recentActivity.map((event, index) => (
            <div key={event.id} className="relative flex gap-5 pb-8 last:pb-0">
              {index < detail.recentActivity.length - 1 && (
                <div className="absolute left-[5px] top-3 h-[calc(100%-4px)] w-px bg-white/[0.08]" />
              )}
              <div className="relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border border-white/[0.12] bg-[#0a0812]" />
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-medium text-gray-600">
                  {formatRelativeTime(event.occurredAt)}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-gray-300">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
