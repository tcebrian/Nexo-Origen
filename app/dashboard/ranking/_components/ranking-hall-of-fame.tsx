"use client";

import Link from "next/link";
import { getMedal } from "@/lib/ranking/filters";
import type { RankingRecord } from "@/lib/ranking/types";
import { cardInteractive, sectionPad, shell } from "./ui/ranking-styles";
import { SectionLabel } from "./ui/section-label";

type RankingHallOfFameProps = {
  items: RankingRecord[];
};

export function RankingHallOfFame({ items }: RankingHallOfFameProps) {
  return (
    <div className={`${shell} h-full`}>
      <div className={sectionPad}>
        <SectionLabel
          kicker="Consistencia"
          title="Hall of Fame"
          description="Locales que más tiempo llevan por encima del objetivo."
        />
      </div>

      {items.length === 0 ? (
        <div className="border-t border-white/[0.06] px-5 py-10 text-center text-sm text-gray-500 lg:px-6">
          Ningún local cumple el criterio de consistencia.
        </div>
      ) : (
        <div className="grid gap-3 border-t border-white/[0.06] p-4 sm:grid-cols-3 lg:px-6 lg:pb-6">
          {items.map((item, index) => (
            <Link
              key={item.id}
              href={`/dashboard/restaurantes/${item.restaurantSlug}`}
              className={`group flex flex-col items-center justify-center px-4 py-5 text-center ${cardInteractive}`}
            >
              <span className="text-2xl" aria-hidden>
                {getMedal(index) ?? "★"}
              </span>
              <p className="mt-3 truncate text-sm font-medium text-gray-100 group-hover:text-white">
                {item.restaurant}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {item.monthsAboveTarget} meses consecutivos
              </p>
              <p className="mt-1 text-[11px] font-medium tabular-nums text-violet-300/90">
                {item.media.toFixed(1)}★ media
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
