"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportPeriodSlug } from "@/lib/reports/period-ranges";
import { REPORT_PERIOD_LABELS } from "@/lib/reports/period-ranges";
import type { NetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { card, shell, textKicker, textTitle } from "./ui/informes-styles";
import { NetworkSummaryImageModal } from "./network-summary-image-modal";
import { DownloadAllImagesButton } from "./download-all-images-button";

type InformesPeriodoBrandsProps = {
  periodo: ReportPeriodSlug;
  offset: number;
  rangeLabel: string;
};

const PERIODO_UNIT_LABEL: Record<ReportPeriodSlug, string> = {
  semanal: "semana",
  mensual: "mes",
  trimestral: "trimestre",
};

/**
 * Ribs, Sibuya y Volapié comparten un único informe PNG combinado ("Grupo
 * Hámbar") en vez de uno por marca — así lo pidió el usuario, siguiendo el
 * mismo formato que ya usan a mano cada semana. Santa Gloria es al revés:
 * una sola marca pero dos PNG (España / Andorra, redes con dinámicas
 * distintas). Los PDF por restaurante están desactivados por ahora (la ruta
 * /api/informes/marca sigue existiendo, solo se quitaron los botones).
 */
const REPORT_GROUPS: {
  label: string;
  sublabel?: string;
  pngGroups: { id: NetworkReportGroupId; label: string }[];
}[] = [
  { label: "Burger King", pngGroups: [{ id: "bk", label: "PNG" }] },
  { label: "Popeyes", pngGroups: [{ id: "pp", label: "PNG" }] },
  {
    label: "Santa Gloria",
    pngGroups: [
      { id: "sg-es", label: "PNG España" },
      { id: "sg-ad", label: "PNG Andorra" },
    ],
  },
  { label: "Tim Hortons", pngGroups: [{ id: "th", label: "PNG" }] },
  {
    label: "Grupo Hámbar",
    sublabel: "Ribs · Sibuya · Volapié",
    pngGroups: [{ id: "hambar", label: "PNG" }],
  },
  {
    label: "Vault",
    sublabel: "Empresa independiente · se descarga aparte",
    pngGroups: [{ id: "vault", label: "PNG" }],
  },
];

function ImageIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ direction, className = "" }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InformesPeriodoBrands({ periodo, offset, rangeLabel }: InformesPeriodoBrandsProps) {
  const [pngGroup, setPngGroup] = useState<{ id: NetworkReportGroupId; label: string } | null>(null);
  const unit = PERIODO_UNIT_LABEL[periodo];

  return (
    <div className="relative flex min-h-0 flex-col gap-6 pb-10">
      <header className="mb-2 shrink-0 border-b border-[var(--nexo-border)] pb-5">
        <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--nexo-text-tertiary)]">
          <Link href="/dashboard" className="transition hover:text-[var(--nexo-text-secondary)]">
            Inicio
          </Link>
          <span>/</span>
          <Link href="/dashboard/informes" className="transition hover:text-[var(--nexo-text-secondary)]">
            Informes
          </Link>
          <span>/</span>
          <span className="text-[var(--nexo-text-secondary)]">{REPORT_PERIOD_LABELS[periodo]}</span>
        </nav>

        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-accent)]">
          Informes visuales
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[28px]">
          {REPORT_PERIOD_LABELS[periodo]}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-1">
            <Link
              href={`/dashboard/informes/${periodo}?offset=${offset + 1}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--nexo-text-secondary)] transition hover:bg-[var(--nexo-inset)] hover:text-[var(--nexo-text)]"
              title={`${unit.charAt(0).toUpperCase() + unit.slice(1)} anterior`}
            >
              <ChevronIcon direction="left" className="h-4 w-4" />
            </Link>
            <span className="px-2 text-[13px] font-medium text-[var(--nexo-text)]">{rangeLabel}</span>
            {offset > 0 ? (
              <Link
                href={`/dashboard/informes/${periodo}?offset=${offset - 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--nexo-text-secondary)] transition hover:bg-[var(--nexo-inset)] hover:text-[var(--nexo-text)]"
                title={`${unit.charAt(0).toUpperCase() + unit.slice(1)} siguiente`}
              >
                <ChevronIcon direction="right" className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center text-[var(--nexo-text-tertiary)] opacity-30">
                <ChevronIcon direction="right" className="h-4 w-4" />
              </span>
            )}
          </div>
          <p className="text-[13px] text-[var(--nexo-text-secondary)]">
            {offset === 0 ? `Última ${unit} completa` : `${offset + 1} ${unit}s atrás`}
          </p>
        </div>
      </header>

      <section className={shell}>
        <div className="p-5 pt-6 lg:p-8 lg:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={textKicker}>Elige una marca</p>
              <h2 className={`mt-1.5 ${textTitle}`}>Marcas</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Cada PNG compara toda la red de la marca en una sola imagen.
              </p>
            </div>
            <DownloadAllImagesButton periodo={periodo} offset={offset} rangeLabel={rangeLabel} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORT_GROUPS.map((group) => (
              <div
                key={group.label}
                className={`${card} flex flex-col gap-4 rounded-2xl border-white/[0.06] px-5 py-4`}
              >
                <div>
                  <span className="block text-[15px] font-medium text-gray-100">{group.label}</span>
                  {"sublabel" in group ? (
                    <span className="mt-0.5 block text-[12px] text-gray-500">{group.sublabel}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.pngGroups.map((png) => (
                    <button
                      key={png.id}
                      type="button"
                      onClick={() => setPngGroup({ id: png.id, label: group.label })}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3.5 py-2 text-[13px] font-medium text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-500/25 hover:text-white"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {png.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NetworkSummaryImageModal
        periodo={periodo}
        offset={offset}
        rangeLabel={rangeLabel}
        grupo={pngGroup}
        onClose={() => setPngGroup(null)}
      />
    </div>
  );
}
