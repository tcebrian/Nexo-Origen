"use client";

import Link from "next/link";
import { useDashboardControls } from "../../_components/dashboard-controls";
import { TenantBadge } from "../../_components/tenant-badge";

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

type InformesHeaderProps = {
  periodLabel: string;
};

export function InformesHeader({ periodLabel }: InformesHeaderProps) {
  const { openPanel } = useDashboardControls();

  return (
    <header className="mb-2 shrink-0 border-b border-[var(--nexo-border)] pb-5">
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--nexo-text-tertiary)]">
        <Link href="/dashboard" className="transition hover:text-[var(--nexo-text-secondary)]">
          Inicio
        </Link>
        <span>/</span>
        <span className="text-[var(--nexo-text-secondary)]">Informes</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-accent)]">
            Informes visuales
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[28px]">
            Informes
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">
            Genera informes automáticos por marca: semanales, mensuales y trimestrales.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <TenantBadge />
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3.5 py-2 text-sm font-medium text-[var(--nexo-text)] transition hover:border-[var(--nexo-border-strong)]"
          >
            <IconCalendar />
            <span className="truncate">{periodLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
