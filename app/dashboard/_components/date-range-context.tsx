"use client";

import {
  getPeriodBoundsFromDates,
  parseDateKeyStart,
  toDateKey,
} from "@/lib/dates/period";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SESSION_PERIOD_KEY = "nexo-origen-session-period";

export type DateRange = {
  start: Date;
  end: Date;
  source: "calendar" | "saved" | "preset";
};

type DateRangeContextValue = {
  range: DateRange;
  setRange: (start: Date, end: Date, source?: DateRange["source"]) => void;
  resetToToday: () => void;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function buildRange(start: Date, end: Date, source: DateRange["source"] = "calendar"): DateRange {
  const normalizedStart = normalizeDate(start);
  const normalizedEnd = normalizeDate(end);

  if (normalizedStart > normalizedEnd) {
    return {
      start: normalizedEnd,
      end: normalizedStart,
      source,
    };
  }

  return {
    start: normalizedStart,
    end: normalizedEnd,
    source,
  };
}

function getTodayRange(): DateRange {
  const today = normalizeDate(new Date());
  return buildRange(today, today, "preset");
}

/** Rango inicial: semana natural actual (lunes a domingo). */
function getDefaultRange(): DateRange {
  const today = normalizeDate(new Date());
  const day = today.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const diffToMonday = day === 0 ? 6 : day - 1;

  const start = normalizeDate(new Date(today));
  start.setDate(start.getDate() - diffToMonday);

  const end = normalizeDate(new Date(today));
  end.setDate(end.getDate() + (6 - diffToMonday));

  return buildRange(start, end, "preset");
}

function parseSessionRange(value: string | null): DateRange | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as {
      start?: string;
      end?: string;
      source?: DateRange["source"];
    };
    if (!parsed.start || !parsed.end) return null;

    const start = parseDateKeyStart(parsed.start);
    const end = parseDateKeyStart(parsed.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    const source =
      parsed.source === "calendar" || parsed.source === "saved" || parsed.source === "preset"
        ? parsed.source
        : "calendar";

    return buildRange(start, end, source);
  } catch {
    return null;
  }
}

function persistSessionRange(range: DateRange) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    SESSION_PERIOD_KEY,
    JSON.stringify({
      start: formatDateInput(range.start),
      end: formatDateInput(range.end),
      source: range.source,
    })
  );
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(getDefaultRange);
  useEffect(() => {
    const sessionRange = parseSessionRange(sessionStorage.getItem(SESSION_PERIOD_KEY));
    if (sessionRange) {
      setRangeState(sessionRange);
    } else {
      const initial = getDefaultRange();
      setRangeState(initial);
      persistSessionRange(initial);
    }
  }, []);

  const value = useMemo(
    () => ({
      range,
      setRange: (start: Date, end: Date, source: DateRange["source"] = "calendar") => {
        const next = buildRange(start, end, source);
        setRangeState(next);
        persistSessionRange(next);
      },
      resetToToday: () => {
        const today = getTodayRange();
        setRangeState(today);
        persistSessionRange(today);
      },
    }),
    [range]
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDateRange must be used within DateRangeProvider");
  }
  return context;
}

export function getSelectedRange(range: DateRange): DateRange {
  const bounds = getPeriodBoundsFromDates(range.start, range.end);
  return { ...range, start: bounds.start, end: bounds.end };
}

export function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatSelectedDateShort(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateRangeLabel(range: DateRange) {
  if (isSameDay(range.start, range.end)) {
    return formatSelectedDate(range.start);
  }
  return `${formatSelectedDateShort(range.start)} – ${formatSelectedDateShort(range.end)}`;
}

export function formatDateInput(date: Date) {
  return toDateKey(date);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isDateInRange(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const time = normalizeDate(date).getTime();
  const from = normalizeDate(start).getTime();
  const to = normalizeDate(end).getTime();
  return time >= Math.min(from, to) && time <= Math.max(from, to);
}

export function getDaysInRange(range: DateRange) {
  const bounds = getPeriodBoundsFromDates(range.start, range.end);
  const start = parseDateKeyStart(bounds.startKey);
  const end = parseDateKeyStart(bounds.endKey);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
}
