"use client";

import { parseDateKeyStart } from "@/lib/dates/period";
import type { RestaurantDayBreakdown } from "@/lib/restaurants/types";

function dayMeta(dateKey: string) {
  const date = parseDateKeyStart(dateKey);
  const weekday = date.toLocaleDateString("es-ES", { weekday: "long" });
  const weekdayShort = date.toLocaleDateString("es-ES", { weekday: "short" }).replace(/\./g, "");
  const dayNum = date.getDate();
  const month = date.toLocaleDateString("es-ES", { month: "short" }).replace(/\./g, "");

  return { weekday, weekdayShort, dayNum, month };
}

type RestaurantDayActivityChartProps = {
  days: RestaurantDayBreakdown[];
};

export function RestaurantDayActivityChart({ days }: RestaurantDayActivityChartProps) {
  if (days.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--nexo-border)] bg-[var(--nexo-inset)]/50 px-6 text-center">
        <p className="text-[15px] text-[var(--nexo-text-secondary)]">Sin actividad de reseñas en el periodo</p>
      </div>
    );
  }

  const maxTotal = Math.max(...days.map((day) => day.positive + day.negative), 1);
  const columnClass =
    days.length <= 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : days.length <= 5
        ? "sm:grid-cols-3 lg:grid-cols-5"
        : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7";

  return (
    <div className={`grid grid-cols-1 gap-4 ${columnClass}`}>
      {days.map((day) => {
        const meta = dayMeta(day.dateKey);
        const total = day.positive + day.negative;
        const barMax = 156;
        const posHeight = total > 0 ? Math.max(8, Math.round((day.positive / maxTotal) * barMax)) : 0;
        const negHeight = total > 0 ? Math.max(8, Math.round((day.negative / maxTotal) * barMax)) : 0;
        const isEmpty = total === 0;

        return (
          <article
            key={day.dateKey}
            className="group flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[var(--nexo-border)] bg-gradient-to-b from-[var(--nexo-card)] to-[var(--nexo-inset)] shadow-[var(--nexo-shadow-sm)] transition hover:border-violet-400/25 hover:shadow-[0_12px_40px_rgba(109,40,217,0.12)]"
          >
            <header className="border-b border-[var(--nexo-border)] bg-white/[0.02] px-4 py-5 text-center">
              <p className="hidden text-[18px] font-semibold capitalize tracking-[0.02em] text-violet-300/95 sm:block">
                {meta.weekday}
              </p>
              <p className="text-[17px] font-bold uppercase tracking-[0.16em] text-violet-300/90 sm:hidden">
                {meta.weekdayShort}
              </p>
              <p className="mt-2 font-mono text-[44px] font-bold leading-none tabular-nums tracking-tight text-[var(--nexo-text)]">
                {meta.dayNum}
              </p>
              <p className="mt-2 text-[18px] font-medium capitalize text-[var(--nexo-text-secondary)]">
                {meta.month}
              </p>
            </header>

            <div className="flex flex-1 flex-col items-center justify-end px-4 pb-5 pt-6">
              <div className="flex h-[168px] w-full max-w-[88px] items-end justify-center gap-2">
                <div className="flex h-full w-9 flex-col items-center justify-end gap-2">
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-emerald-400/90">
                    {day.positive > 0 ? day.positive : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-[14px] bg-gradient-to-t from-emerald-700 to-emerald-500 shadow-[0_8px_20px_rgba(4,120,87,0.28)] ${
                      isEmpty ? "h-2 bg-white/[0.06] shadow-none" : ""
                    }`}
                    style={day.positive > 0 ? { height: posHeight } : { height: isEmpty ? 8 : 4 }}
                    title={`${day.positive} positivas`}
                  />
                </div>

                <div className="flex h-full w-9 flex-col items-center justify-end gap-2">
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-red-400/90">
                    {day.negative > 0 ? day.negative : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-[14px] bg-gradient-to-t from-red-800 to-red-600 shadow-[0_8px_20px_rgba(185,28,28,0.28)] ${
                      isEmpty ? "h-2 bg-white/[0.06] shadow-none" : ""
                    }`}
                    style={day.negative > 0 ? { height: negHeight } : { height: isEmpty ? 8 : 4 }}
                    title={`${day.negative} negativas`}
                  />
                </div>
              </div>

              <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2">
                {day.positive > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[13px] font-semibold text-emerald-300">
                    +{day.positive} buenas
                  </span>
                ) : null}
                {day.negative > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-[13px] font-semibold text-red-300">
                    {day.negative} malas
                  </span>
                ) : null}
                {isEmpty ? (
                  <span className="rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3 py-1 text-[13px] text-[var(--nexo-text-tertiary)]">
                    Sin reseñas
                  </span>
                ) : (
                  <span className="w-full text-center font-mono text-[12px] tabular-nums text-[var(--nexo-text-tertiary)]">
                    {total} en total
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
