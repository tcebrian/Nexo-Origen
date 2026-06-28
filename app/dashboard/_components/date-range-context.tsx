"use client";

import {
  getPeriodBoundsFromDates,
  parseDateKeyStart,
  toDateKey,
} from "@/lib/dates/period";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SAVED_PERIOD_KEY = "nexo-origen-saved-period";
const SESSION_PERIOD_KEY = "nexo-origen-session-period";

export type DateRange = {
  start: Date;
  end: Date;
  source: "calendar" | "saved" | "preset";
};

export type SavedPeriod = {
  start: Date;
  end: Date;
};

type DateRangeContextValue = {
  range: DateRange;
  savedPeriod: SavedPeriod | null;
  setRange: (start: Date, end: Date, source?: DateRange["source"]) => void;
  savePeriod: (start: Date, end: Date) => void;
  applySavedPeriod: () => void;
  clearSavedPeriod: () => void;
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

/** Rango inicial: últimas 2 semanas (las reseñas rara vez son solo de hoy). */
function getDefaultRange(): DateRange {
  const end = normalizeDate(new Date());
  const start = normalizeDate(new Date());
  start.setDate(start.getDate() - 13);
  return buildRange(start, end, "preset");
}

function parseStoredPeriod(value: string | null): SavedPeriod | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { start?: string; end?: string };
    if (!parsed.start || !parsed.end) return null;

    const start = parseDateKeyStart(parsed.start);
    const end = parseDateKeyStart(parsed.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    return buildRange(start, end);
  } catch {
    return null;
  }
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
  const [savedPeriod, setSavedPeriod] = useState<SavedPeriod | null>(null);
  useEffect(() => {
    const sessionRange = parseSessionRange(sessionStorage.getItem(SESSION_PERIOD_KEY));
    if (sessionRange) {
      setRangeState(sessionRange);
    } else {
      const initial = getDefaultRange();
      setRangeState(initial);
      persistSessionRange(initial);
    }

    setSavedPeriod(parseStoredPeriod(localStorage.getItem(SAVED_PERIOD_KEY)));
  }, []);

  const value = useMemo(
    () => ({
      range,
      savedPeriod,
      setRange: (start: Date, end: Date, source: DateRange["source"] = "calendar") => {
        const next = buildRange(start, end, source);
        setRangeState(next);
        persistSessionRange(next);
      },
      savePeriod: (start: Date, end: Date) => {
        const period = buildRange(start, end);
        localStorage.setItem(
          SAVED_PERIOD_KEY,
          JSON.stringify({
            start: formatDateInput(period.start),
            end: formatDateInput(period.end),
          })
        );
        setSavedPeriod({ start: period.start, end: period.end });
        const next = { ...period, source: "saved" as const };
        setRangeState(next);
        persistSessionRange(next);
      },
      applySavedPeriod: () => {
        if (!savedPeriod) return;
        const next = buildRange(savedPeriod.start, savedPeriod.end, "saved");
        setRangeState(next);
        persistSessionRange(next);
      },
      clearSavedPeriod: () => {
        localStorage.removeItem(SAVED_PERIOD_KEY);
        setSavedPeriod(null);
      },
      resetToToday: () => {
        const today = getTodayRange();
        setRangeState(today);
        persistSessionRange(today);
      },
    }),
    [range, savedPeriod]
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
