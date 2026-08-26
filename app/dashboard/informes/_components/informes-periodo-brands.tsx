"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportPeriodSlug } from "@/lib/reports/period-ranges";
import { REPORT_PERIOD_LABELS } from "@/lib/reports/period-ranges";
import type { NetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { card, shell, textKicker, textTitle } from "./ui/informes-styles";
import { NetworkSummaryImageModal } from "./network-summary-image-modal";

type InformesPeriodoBrandsProps = {
  periodo: ReportPeriodSlug;
  rangeLabel: string;
};

/**
 * Ribs, Sibuya y Volapié comparten un único informe PNG combinado ("Grupo
 * Hámbar") en vez de uno por marca — así lo pidió el usuario, siguiendo el
 * mismo formato que ya usan a mano cada semana. El PDF no se agrupa: sigue
 * siendo uno por marca (restaurante a restaurante), sin tocar cómo funciona
 * hoy.
 */
const REPORT_GROUPS: { id: NetworkReportGroupId; label: string; sublabel?: string; pdfBrands: string[] }[] = [
  { id: "bk", label: "Burger King", pdfBrands: ["Burger King"] },
  { id: "pp", label: "Popeyes", pdfBrands: ["Popeyes"] },
  { id: "sg", label: "Santa Gloria", pdfBrands: ["Santa Gloria"] },
  { id: "th", label: "Tim Hortons", pdfBrands: ["Tim Hortons"] },
  {
    id: "hambar",
    label: "Grupo Hámbar",
    sublabel: "Ribs · Sibuya · Volapié",
    pdfBrands: ["Ribs", "Sibuya", "Taberna Volapié"],
  },
  { id: "vault", label: "Vault", pdfBrands: ["Vault"] },
];

function DocumentIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-4-5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InformesPeriodoBrands({ periodo, rangeLabel }: InformesPeriodoBrandsProps) {
  const [pngGroup, setPngGroup] = useState<{ id: NetworkReportGroupId; label: string } | null>(null);

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
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">
          Periodo analizado: {rangeLabel}
        </p>
      </header>

      <section className={shell}>
        <div className="p-5 pt-6 lg:p-8 lg:pt-8">
          <p className={textKicker}>Elige una marca</p>
          <h2 className={`mt-1.5 ${textTitle}`}>Marcas</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            El PDF es el informe individual por restaurante. El PNG compara toda la red de la marca en una sola
            imagen.
          </p>

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
                  {group.pdfBrands.map((brandName) => (
                    <a
                      key={brandName}
                      href={`/api/informes/marca?brand=${encodeURIComponent(brandName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3.5 py-2 text-[13px] font-medium text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-500/25 hover:text-white"
                    >
                      <DocumentIcon className="h-4 w-4" />
                      PDF{group.pdfBrands.length > 1 ? ` ${brandName}` : ""}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPngGroup({ id: group.id, label: group.label })}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3.5 py-2 text-[13px] font-medium text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-500/25 hover:text-white"
                  >
                    <ImageIcon className="h-4 w-4" />
                    PNG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NetworkSummaryImageModal periodo={periodo} grupo={pngGroup} onClose={() => setPngGroup(null)} />
    </div>
  );
}
