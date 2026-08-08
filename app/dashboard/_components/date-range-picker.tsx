"use client";

import { useEffect, useRef, useState } from "react";
import { parseDateKeyStart } from "@/lib/dates/period";
import { Calendar } from "./calendar";
import { glass } from "./styles";
import {
  formatDateInput,
  formatDateRangeLabel,
  useDateRange,
} from "./date-range-context";

type DateRangePickerProps = {
  variant?: "dropdown" | "inline";
  onApplied?: () => void;
};

export function DateRangePicker({ variant = "dropdown", onApplied }: DateRangePickerProps) {
  const { range, setRange } = useDateRange();
  const [open, setOpen] = useState(variant === "inline");
  const [viewDate, setViewDate] = useState(range.end);
  const [draftStart, setDraftStart] = useState<Date | null>(range.start);
  const [draftEnd, setDraftEnd] = useState<Date | null>(range.end);
  const ref = useRef<HTMLDivElement>(null);

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

  function handleStartInput(value: string) {
    if (!value) return;
    const date = parseDateKeyStart(value);
    if (Number.isNaN(date.getTime())) return;
    setDraftStart(date);
    setViewDate(date);
    if (draftEnd && date > draftEnd) setDraftEnd(null);
  }

  function handleEndInput(value: string) {
    if (!value) return;
    const date = parseDateKeyStart(value);
    if (Number.isNaN(date.getTime())) return;
    setDraftEnd(date);
    setViewDate(date);
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
          : "absolute right-0 top-[calc(100%+12px)] z-50 w-[360px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09070f]/95 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      }
    >
      <div className={`space-y-3 ${variant === "inline" ? "" : "px-5 py-4"}`}>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-gray-600">Desde</span>
            <input
              type="date"
              value={draftStart ? formatDateInput(draftStart) : ""}
              onChange={(event) => handleStartInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-gray-200 outline-none [color-scheme:dark] focus:border-violet-400/40"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-gray-600">Hasta</span>
            <input
              type="date"
              value={draftEnd ? formatDateInput(draftEnd) : ""}
              onChange={(event) => handleEndInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-gray-200 outline-none [color-scheme:dark] focus:border-violet-400/40"
            />
          </label>
        </div>

        <Calendar
          viewDate={viewDate}
          rangeStart={draftStart}
          rangeEnd={draftEnd}
          onViewChange={setViewDate}
          onSelect={handleDaySelect}
        />
      </div>

      <div className={`border-t border-white/[0.06] bg-black/20 ${variant === "inline" ? "pt-4" : "px-5 py-4"}`}>
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
          className="w-full rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-600/30 to-purple-700/20 py-2.5 text-[12px] font-medium text-violet-100 transition hover:from-violet-600/40 hover:to-purple-700/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Aplicar periodo
        </button>
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
