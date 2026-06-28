"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "./calendar";
import { glass } from "./styles";
import {
  formatDateRangeLabel,
  formatSelectedDateShort,
  useDateRange,
} from "./date-range-context";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
}

const quickPresets = [
  { id: "today", label: "Hoy", getRange: (ref: Date) => ({ start: ref, end: ref }) },
  { id: "7d", label: "Últimos 7 días", getRange: (ref: Date) => ({ start: addDays(ref, -6), end: ref }) },
  { id: "30d", label: "Últimos 30 días", getRange: (ref: Date) => ({ start: addDays(ref, -29), end: ref }) },
  { id: "month", label: "Este mes", getRange: (ref: Date) => ({ start: startOfMonth(ref), end: endOfMonth(ref) }) },
  {
    id: "prev",
    label: "Mes anterior",
    getRange: (ref: Date) => {
      const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 12, 0, 0, 0);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    },
  },
] as const;

type DateRangePickerProps = {
  variant?: "dropdown" | "inline";
  onApplied?: () => void;
};

export function DateRangePicker({ variant = "dropdown", onApplied }: DateRangePickerProps) {
  const { range, savedPeriod, setRange, savePeriod, applySavedPeriod, clearSavedPeriod } = useDateRange();
  const [open, setOpen] = useState(variant === "inline");
  const [viewDate, setViewDate] = useState(range.end);
  const [draftStart, setDraftStart] = useState<Date | null>(range.start);
  const [draftEnd, setDraftEnd] = useState<Date | null>(range.end);
  const ref = useRef<HTMLDivElement>(null);

  const referenceDate = (() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  })();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setViewDate(range.end);
      setDraftStart(range.start);
      setDraftEnd(range.end);
    }
  }, [open, range.start, range.end]);

  function handleDaySelect(date: Date) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }

    setDraftEnd(date);
  }

  const draftRange =
    draftStart && draftEnd
      ? { start: draftStart, end: draftEnd }
      : draftStart
        ? { start: draftStart, end: draftStart }
        : null;

  const panel = open ? (
    <div
      className={
        variant === "inline"
          ? "w-full"
          : "absolute right-0 top-[calc(100%+12px)] z-50 w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09070f]/95 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      }
    >
      {variant === "dropdown" && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-400/80">
            Seleccionar periodo
          </p>
          <p className="mt-1 text-[15px] font-medium text-white">
            {draftRange ? formatDateRangeLabel({ ...draftRange, source: "calendar" }) : "Elige inicio y fin"}
          </p>
          <p className="mt-1 text-[12px] text-gray-500">
            Haz clic en la fecha de inicio y después en la fecha de fin.
          </p>
        </div>
      )}

      <div className={`space-y-3 ${variant === "inline" ? "" : "px-5 py-4"}`}>
        <div className="grid grid-cols-2 gap-2">
          {quickPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const next = preset.getRange(referenceDate);
                setDraftStart(next.start);
                setDraftEnd(next.end);
                setViewDate(next.end);
              }}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-[11px] text-gray-400 transition hover:border-violet-400/20 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-gray-600">Desde</p>
            <p className="mt-1 text-[12px] text-gray-300">
              {draftStart ? formatSelectedDateShort(draftStart) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-gray-600">Hasta</p>
            <p className="mt-1 text-[12px] text-gray-300">
              {draftEnd ? formatSelectedDateShort(draftEnd) : draftStart ? "Selecciona fin" : "—"}
            </p>
          </div>
        </div>

        <Calendar
          viewDate={viewDate}
          rangeStart={draftStart}
          rangeEnd={draftEnd}
          savedPeriod={savedPeriod}
          onViewChange={setViewDate}
          onSelect={handleDaySelect}
        />
      </div>

      <div className={`space-y-3 border-t border-white/[0.06] bg-black/20 ${variant === "inline" ? "pt-4" : "px-5 py-4"}`}>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Periodo guardado</p>
          {savedPeriod ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-gray-300">
                {formatDateRangeLabel({ ...savedPeriod, source: "saved" })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    applySavedPeriod();
                    if (variant === "dropdown") setOpen(false);
                    onApplied?.();
                  }}
                  className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 transition hover:bg-amber-500/15"
                >
                  Usar
                </button>
                <button
                  type="button"
                  onClick={clearSavedPeriod}
                  className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-gray-500 transition hover:text-gray-300"
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-gray-600">Puedes guardar un único periodo de referencia.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (!draftStart) return;
              const end = draftEnd ?? draftStart;
              savePeriod(draftStart, end);
            }}
            disabled={!draftStart}
            className="rounded-xl border border-amber-400/20 bg-amber-500/10 py-2.5 text-[12px] font-medium text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar periodo
          </button>
          <button
            type="button"
            onClick={() => {
              if (!draftStart) return;
              const end = draftEnd ?? draftStart;
              setRange(draftStart, end, "calendar");
              if (variant === "dropdown") setOpen(false);
              onApplied?.();
            }}
            disabled={!draftStart}
            className="rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-600/30 to-purple-700/20 py-2.5 text-[12px] font-medium text-violet-100 transition hover:from-violet-600/40 hover:to-purple-700/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar periodo
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (variant === "inline") {
    return (
      <div ref={ref} className="relative">
        <div className="mb-3 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-gray-600">Periodo seleccionado</p>
          <p className="mt-1 text-[13px] text-gray-200">
            {draftRange ? formatDateRangeLabel({ ...draftRange, source: "calendar" }) : formatDateRangeLabel(range)}
          </p>
        </div>
        {panel}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex min-w-[280px] items-center gap-3 px-4 py-3 text-sm transition hover:border-violet-400/25 ${glass}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-600/20 to-purple-700/10 text-violet-300">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex-1 text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
            Periodo de análisis
          </span>
          <span className="block text-[13px] text-gray-100">{formatDateRangeLabel(range)}</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {panel}
    </div>
  );
}
