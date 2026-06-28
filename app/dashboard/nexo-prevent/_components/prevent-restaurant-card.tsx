"use client";

import Link from "next/link";
import { PREVENT_STATUS_META } from "@/lib/prevent/status";
import type { PreventRecord } from "@/lib/prevent/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import {
  btnOutline,
  insightBlock,
  metricPill,
  restaurantCard,
  restaurantCardHover,
  textKicker,
} from "./ui/prevent-styles";

type PreventRestaurantCardProps = {
  record: PreventRecord;
};

export function PreventRestaurantCard({ record }: PreventRestaurantCardProps) {
  const meta = PREVENT_STATUS_META[record.status];
  const isOutside = record.status === "fuera_objetivo";

  return (
    <article className={`${restaurantCard} ${restaurantCardHover} border-l-2 ${meta.cardEdge}`}>
      <div className="flex items-start justify-between gap-4">
        <RestaurantBrandLine
          brand={record.brand}
          name={record.restaurant}
          logoSize="sm"
          nameClassName="text-[16px] font-medium tracking-[-0.01em] text-[var(--nexo-text)]"
        />
        <span className={`${metricPill} ${meta.pill}`}>{meta.label}</span>
      </div>

      <div className="mt-7 grid gap-5 border-t border-[var(--nexo-border)] pt-6 sm:grid-cols-2">
        <div>
          <p className={textKicker}>Media actual</p>
          <p className="mt-2 font-mono text-[22px] font-light tabular-nums tracking-tight text-[var(--nexo-text)]">
            {record.currentMedia.toFixed(1)}
          </p>
        </div>

        <div>
          <p className={textKicker}>{isOutside ? "Necesita" : "Puede soportar"}</p>
          <p className={`mt-2 font-mono text-[22px] font-light tabular-nums tracking-tight ${meta.metricAccent}`}>
            {isOutside ? (
              <>
                +{record.positivesNeeded}{" "}
                <span className="text-[14px] font-normal text-[var(--nexo-text-tertiary)]">reseñas positivas</span>
              </>
            ) : (
              <>
                {record.negativesTolerance}{" "}
                <span className="text-[14px] font-normal text-[var(--nexo-text-tertiary)]">
                  reseña{record.negativesTolerance === 1 ? "" : "s"} negativa
                  {record.negativesTolerance === 1 ? "" : "s"}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className={`${insightBlock} mt-5`}>
        <p className={textKicker}>Acción</p>
        <p className="mt-2 text-[14px] text-[var(--nexo-text-secondary)]">{record.action}</p>
      </div>

      <Link
        href={`/dashboard/restaurantes/${record.restaurantSlug}`}
        className={`${btnOutline} mt-5 inline-flex`}
      >
        Ver restaurante
      </Link>
    </article>
  );
}
