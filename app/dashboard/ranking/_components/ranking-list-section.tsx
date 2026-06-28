"use client";

import Link from "next/link";
import { formatMediaChange, getMedal } from "@/lib/ranking/filters";
import type { RankingRecord } from "@/lib/ranking/types";
import { BRAND_VISUALS } from "@/lib/restaurants/brand-visuals";
import { MiniSparkline } from "../../_components/charts";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { card, metricPill, sectionPad, shell } from "./ui/ranking-styles";
import { SectionLabel } from "./ui/section-label";

type RankingListSectionProps = {
  kicker: string;
  title: string;
  description?: string;
  items: RankingRecord[];
  variant: "top" | "improved" | "risk";
  emptyMessage: string;
  className?: string;
};

function ChangeBadge({ value, variant }: { value: number; variant: "improved" | "risk" }) {
  const isPositive = variant === "improved";
  return (
    <span
      className={`${metricPill} shrink-0 ${
        isPositive
          ? "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]"
          : "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]"
      }`}
    >
      {formatMediaChange(value)}
    </span>
  );
}

function RankingRow({
  item,
  index,
  variant,
  isLast,
}: {
  item: RankingRecord;
  index: number;
  variant: RankingListSectionProps["variant"];
  isLast: boolean;
}) {
  const medal = variant === "top" ? getMedal(index) : null;
  const prefix =
    variant === "improved" ? (
      "↑"
    ) : variant === "risk" ? (
      "↓"
    ) : medal ? (
      medal
    ) : (
      <span className="text-xs font-medium tabular-nums text-[var(--nexo-text-tertiary)]">
        {index + 1}
      </span>
    );

  return (
    <Link
      href={`/dashboard/restaurantes/${item.restaurantSlug}`}
      className={`group flex min-h-[56px] items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--nexo-inset)] lg:px-5 ${
        isLast ? "" : "border-b border-[var(--nexo-border)]"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex w-7 shrink-0 items-center justify-center text-sm font-medium text-[var(--nexo-text-secondary)]"
          aria-hidden
        >
          {prefix}
        </span>
        <RestaurantBrandLine
          brand={item.brand}
          name={item.restaurant}
          logoSize="xs"
          nameClassName="min-w-0 truncate text-sm font-medium text-[var(--nexo-text)]"
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {item.sparkline.length > 1 && (
          <MiniSparkline
            values={item.sparkline}
            color={BRAND_VISUALS[item.brand].accent}
            width={64}
            height={28}
          />
        )}
        {variant === "top" && (
          <span className="min-w-[3rem] text-right text-sm font-semibold tabular-nums text-[var(--nexo-text)]">
            {item.media.toFixed(2)}
          </span>
        )}
        {variant === "improved" && <ChangeBadge value={item.mediaChange} variant="improved" />}
        {variant === "risk" && <ChangeBadge value={item.mediaChange} variant="risk" />}
      </div>
    </Link>
  );
}

export function RankingListSection({
  kicker,
  title,
  description,
  items,
  variant,
  emptyMessage,
  className = "",
}: RankingListSectionProps) {
  return (
    <div className={`${shell} flex h-full min-h-0 flex-col ${className}`}>
      <div className={`${sectionPad} shrink-0`}>
        <SectionLabel kicker={kicker} title={title} description={description} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--nexo-border)]">
        {items.length === 0 ? (
          <div
            className={`${card} m-4 flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-[var(--nexo-text-tertiary)]`}
          >
            {emptyMessage}
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {items.map((item, index) => (
              <RankingRow
                key={item.id}
                item={item}
                index={index}
                variant={variant}
                isLast={index === items.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
