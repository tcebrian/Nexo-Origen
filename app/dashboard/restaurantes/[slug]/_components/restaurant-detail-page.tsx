"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { btnGhost, shell } from "../../_components/ui/restaurantes-styles";
import { useRestaurantDetail } from "../../_hooks/use-restaurant-detail";
import { RestaurantDetailHeader } from "./restaurant-detail-header";
import { RestaurantDetailOverview } from "./restaurant-detail-overview";
import { RestaurantDetailReviews } from "./restaurant-detail-reviews";

const TENANT_ID = "grupo-hambar";

export function RestaurantDetailPage({ slug }: { slug: string }) {
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);

  const { detail, loading, error } = useRestaurantDetail(slug, {
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-[1120px] space-y-6 pb-12">
        <div className="space-y-4">
          <div className="h-4 w-40 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-10 w-64 animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-[380px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          <div className="h-[380px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div
        className={`mx-auto flex min-h-[420px] max-w-[1120px] flex-col items-center justify-center ${shell} p-10 text-center`}
      >
        <p className="text-[13px] font-medium text-red-300">{error ?? "Restaurante no encontrado"}</p>
        <Link href="/dashboard/restaurantes" className={`${btnGhost} mt-5`}>
          Volver a restaurantes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] pb-14">
      <RestaurantDetailHeader detail={detail} />
      <RestaurantDetailOverview detail={detail} periodLabel={periodLabel} />
      <RestaurantDetailReviews detail={detail} />
    </div>
  );
}
