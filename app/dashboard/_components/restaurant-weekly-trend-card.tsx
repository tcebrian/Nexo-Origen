"use client";

import { useState } from "react";
import type { TrendWindowMode } from "@/lib/restaurants/weekly-media-trend";
import { glass } from "./styles";
import { skeletonBlock } from "./ui/nexo-styles";
import { useRestaurantWeeklyTrend } from "../restaurantes/_hooks/use-restaurant-weekly-trend";
import { WeeklyMediaLineChart } from "./weekly-media-line-chart";

const MODE_OPTIONS: { id: TrendWindowMode; label: string }[] = [
  { id: "month", label: "Mes" },
  { id: "quarter", label: "Trimestre" },
  { id: "semester", label: "Semestre" },
];

type RestaurantWeeklyTrendCardProps = {
  slug: string;
  targetMedia: number;
};

function NavButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Periodo anterior" : "Periodo siguiente"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-300 transition hover:border-violet-400/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

export function RestaurantWeeklyTrendCard({ slug, targetMedia }: RestaurantWeeklyTrendCardProps) {
  const [mode, setMode] = useState<TrendWindowMode>("month");
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useRestaurantWeeklyTrend(slug, mode, offset);

  const hasReviews = data?.weeks.some((week) => week.reviewCount > 0) ?? false;
  const showChart = !loading && !error && hasReviews && data;

  return (
    <div className={`p-5 ${glass}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[16px] font-medium text-white">Evolución por semanas</h3>
          <p className="mt-1 text-[12px] text-gray-500">
            Independiente del filtro global · datos reales del local
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setMode(option.id);
                setOffset(0);
              }}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                mode === option.id
                  ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                  : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <NavButton direction="prev" onClick={() => setOffset((current) => current - 1)} />
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-medium text-gray-200">
            {loading && !data ? "Cargando…" : (data?.title ?? "—")}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">Media semanal de reseñas</p>
        </div>
        <NavButton
          direction="next"
          onClick={() => setOffset((current) => current + 1)}
          disabled={!data?.canGoForward}
        />
      </div>

      <div className="relative mt-5 h-[300px]">
        {loading && !data ? (
          <div className={`h-full ${skeletonBlock}`} />
        ) : error ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-sm text-gray-500">
            {error}
          </div>
        ) : showChart ? (
          <WeeklyMediaLineChart weeks={data.weeks} goalLine={targetMedia} height={300} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-sm text-gray-500">
            Sin reseñas en este periodo
          </div>
        )}
      </div>

      {data && data.weeks.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {data.weeks.map((week) => (
            <div
              key={week.weekKey}
              className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-center"
            >
              <p className="truncate text-[10px] text-gray-500">{week.label}</p>
              <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-white">
                {week.reviewCount > 0 ? week.media.toFixed(2) : "—"}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-600">{week.reviewCount} reseñas</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
