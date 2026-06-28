"use client";

import Link from "next/link";
import { formatDateRangeLabel, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { useDashboardControls } from "@/app/dashboard/_components/dashboard-controls";
import type { RestaurantDetail } from "@/lib/restaurants/types";
import { RestaurantBrandLine } from "../../../_components/restaurant-brand-line";
import { btnGhost, statusPill } from "../../_components/ui/restaurantes-styles";
import { healthStyles } from "./detail-health-styles";

type RestaurantDetailHeaderProps = {
  detail: RestaurantDetail;
};

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

export function RestaurantDetailHeader({ detail }: RestaurantDetailHeaderProps) {
  const { range } = useDateRange();
  const periodLabel = formatDateRangeLabel(range);
  const { openPanel } = useDashboardControls();
  const health = healthStyles[detail.healthStatus];

  return (
    <header className="mb-8">
      <nav className="mb-5 flex items-center gap-2 text-[12px] text-[var(--nexo-text-tertiary)]">
        <Link href="/dashboard/restaurantes" className="transition hover:text-[var(--nexo-text)]">
          Restaurantes
        </Link>
        <span>/</span>
        <span className="text-[var(--nexo-text)]">{detail.name}</span>
      </nav>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <RestaurantBrandLine
            brand={detail.brand}
            name={detail.name}
            subtitle={detail.location}
            logoSize="md"
            layout="stack"
            className="items-start text-left"
            nameClassName="text-[28px] font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[32px]"
            subtitleClassName="mt-2 text-[14px] text-[var(--nexo-text-secondary)]"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${statusPill[detail.status]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
              {detail.statusLabel}
            </span>
            <span className="text-[12px] text-[var(--nexo-text-tertiary)]">
              Media global {detail.currentMedia.toFixed(2)} · Objetivo {detail.targetMedia.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={openPanel} className={`${btnGhost} gap-2`}>
            <IconCalendar />
            {periodLabel}
          </button>
          <Link href={detail.reviewsHref} className={btnGhost}>
            Ver reseñas
          </Link>
        </div>
      </div>
    </header>
  );
}
