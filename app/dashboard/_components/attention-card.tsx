import Link from "next/link";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import { getReputationOutlook } from "@/lib/restaurants/reputation-outlook";
import { UNIFIED_STATUS_META, fromOperationalStatus } from "@/lib/status/unified";
import { RestaurantBrandLine } from "./restaurant-brand-line";
import { linkAccent, priorityCard, textKicker } from "./ui/nexo-styles";

type AttentionCardProps = {
  restaurant: RestaurantOperational;
};

export function AttentionCard({ restaurant }: AttentionCardProps) {
  const status = fromOperationalStatus(restaurant.status);
  const meta = UNIFIED_STATUS_META[status];
  const outlook = getReputationOutlook(
    restaurant.currentMedia,
    restaurant.totalReviews,
    restaurant.status,
    restaurant.targetMedia
  );
  const needsPositives = outlook.positivesNeeded > 0;
  const hasBuffer = outlook.negativesTolerance > 0;

  return (
    <article className={`${priorityCard} group`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-5">
          <RestaurantBrandLine
            brand={restaurant.brand}
            name={restaurant.name}
            logoSize="md"
            nameClassName="text-[18px] font-semibold tracking-[-0.02em] text-[var(--nexo-text)]"
          />
        </div>

        <span className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium ${meta.pill}`}>
          {meta.executiveLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className={textKicker}>Situación</p>
          <p className="mt-1.5 text-[15px] font-medium leading-snug text-[var(--nexo-text)]">
            {needsPositives ? (
              <>
                Necesita{" "}
                <span className="font-mono text-[var(--nexo-accent)]">+{outlook.positivesNeeded}</span>{" "}
                reseñas positivas
              </>
            ) : hasBuffer ? (
              <>En objetivo con margen de seguridad</>
            ) : (
              <>Requiere seguimiento operativo</>
            )}
          </p>
        </div>

        <div>
          <p className={textKicker}>Margen negativo</p>
          <p className="mt-1.5 text-[15px] font-medium text-[var(--nexo-text)]">
            {hasBuffer ? (
              <>
                Puede soportar <span className="font-mono">{outlook.negativesTolerance}</span> negativas
              </>
            ) : needsPositives ? (
              <>Sin margen: cualquier negativa aleja del objetivo</>
            ) : (
              <>Margen no aplicable</>
            )}
          </p>
        </div>

        <div>
          <p className={textKicker}>Media actual</p>
          <p className="mt-1.5 font-mono text-[15px] font-semibold tabular-nums text-[var(--nexo-text)]">
            {restaurant.currentMedia.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[var(--nexo-border)] pt-5">
        <p className="max-w-xl text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
          {restaurant.recommendedAction}
        </p>
        <Link
          href={`/dashboard/restaurantes/${restaurant.slug}`}
          className={`${linkAccent} shrink-0 opacity-80 transition group-hover:opacity-100`}
        >
          Ver local →
        </Link>
      </div>
    </article>
  );
}
