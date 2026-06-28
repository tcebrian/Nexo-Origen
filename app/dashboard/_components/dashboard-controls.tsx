"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DateRangePicker } from "./date-range-picker";
import { formatDateRangeLabel, useDateRange } from "./date-range-context";
import { FadePopover } from "./motion/slide-panel";

type DashboardControlsContextValue = {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
};

const DashboardControlsContext = createContext<DashboardControlsContextValue | null>(null);

export function useDashboardControls() {
  const context = useContext(DashboardControlsContext);
  if (!context) {
    throw new Error("useDashboardControls must be used within DashboardControlsProvider");
  }
  return context;
}

export function DashboardControlsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = {
    open,
    openPanel: () => setOpen(true),
    closePanel: () => setOpen(false),
    togglePanel: () => setOpen((current) => !current),
  };

  return (
    <DashboardControlsContext.Provider value={value}>
      {children}
      <DashboardControlsPanel />
    </DashboardControlsContext.Provider>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function DashboardControlsPanel() {
  const { range } = useDateRange();
  const { open, closePanel, togglePanel } = useDashboardControls();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closePanel();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closePanel]);

  return (
    <div ref={ref} className="pointer-events-none fixed right-8 top-6 z-50">
      <div className="pointer-events-auto flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={togglePanel}
          title="Cambiar periodo de análisis"
          aria-expanded={open}
          aria-label="Abrir selector de periodo"
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
            open
              ? "border-violet-400/25 bg-violet-500/15 text-violet-200"
              : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-violet-400/20 hover:text-white"
          }`}
        >
          <span className="text-violet-300">
            <CalendarIcon />
          </span>
          <span className="hidden sm:inline">Periodo</span>
        </button>

        <Link
          href="/dashboard/alertas"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 transition hover:border-violet-400/20 hover:text-white"
          aria-label="Ver alertas"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 17a2.5 2.5 0 005 0" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      <FadePopover
        open={open}
        className="pointer-events-auto absolute right-0 top-[calc(100%+10px)] w-[min(440px,calc(100vw-4rem))] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09070f]/95 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      >
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-400/80">
                Periodo de análisis
              </p>
              <p className="mt-1 text-[14px] font-medium text-white">
                {formatDateRangeLabel(range)}
              </p>
              <p className="mt-1 text-[12px] text-gray-500">
                Los datos se calculan dentro de este rango de fechas.
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-gray-500 transition hover:text-gray-300"
            >
              Cerrar
            </button>
          </div>

          <div className="px-5 py-5">
            <DateRangePicker variant="inline" onApplied={closePanel} />
          </div>
      </FadePopover>
    </div>
  );
}
