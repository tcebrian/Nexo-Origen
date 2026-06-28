"use client";

import { isDateInRange, isSameDay } from "./date-range-context";

const weekDays = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

type CalendarProps = {
  viewDate: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  savedPeriod?: { start: Date; end: Date } | null;
  onViewChange: (date: Date) => void;
  onSelect: (date: Date) => void;
};

function getMonthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day, 12, 0, 0, 0));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function Calendar({
  viewDate,
  rangeStart,
  rangeEnd,
  savedPeriod,
  onViewChange,
  onSelect,
}: CalendarProps) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cells = getMonthMatrix(viewDate);
  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(viewDate);
  const hasCompleteRange = Boolean(rangeStart && rangeEnd);

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-400 transition hover:border-violet-400/25 hover:text-white";

  return (
    <div className="select-none">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => onViewChange(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className={navBtn}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className="text-[14px] font-medium capitalize text-white">{monthLabel}</p>

        <button type="button" onClick={() => onViewChange(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className={navBtn}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day} className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-10" />;
          }

          const isStart = rangeStart ? isSameDay(date, rangeStart) : false;
          const isEnd = rangeEnd ? isSameDay(date, rangeEnd) : false;
          const inRange = hasCompleteRange && isDateInRange(date, rangeStart, rangeEnd);
          const isToday = isSameDay(date, today);
          const inSavedPeriod = savedPeriod ? isDateInRange(date, savedPeriod.start, savedPeriod.end) : false;

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelect(date)}
              className={`relative flex h-10 items-center justify-center rounded-xl text-[13px] transition ${
                isStart || isEnd
                  ? "bg-gradient-to-br from-violet-600 to-purple-700 font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                  : inRange
                    ? "bg-violet-500/20 text-violet-100"
                    : isToday
                      ? "border border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15"
                      : "text-gray-300 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {date.getDate()}
              {inSavedPeriod && !isStart && !isEnd && !inRange && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
