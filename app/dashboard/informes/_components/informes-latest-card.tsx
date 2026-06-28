"use client";

import { getStatusIcon, getStatusLabel } from "@/lib/reports/filters";
import type { ReportRecord } from "@/lib/reports/types";
import { btnOutline, btnPrimary, metricPill, sectionPad, shell, textKicker } from "./ui/informes-styles";

type InformesLatestCardProps = {
  report: ReportRecord;
  onView: (report: ReportRecord) => void;
  onDownload: (report: ReportRecord) => void;
  onEmail: (report: ReportRecord) => void;
};

const STATUS_PILL = {
  stable: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  attention: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  risk: "border-red-400/25 bg-red-500/10 text-red-200",
} as const;

export function InformesLatestCard({ report, onView, onDownload, onEmail }: InformesLatestCardProps) {
  return (
    <div className={`relative ${shell}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.12),transparent_55%)]" />

      <div className={`relative ${sectionPad} lg:py-7`}>
        <p className={textKicker}>Último informe disponible</p>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-violet-300/90">
              <span aria-hidden>📅</span>
              <p className="text-sm font-medium">{report.title}</p>
            </div>

            <h2 className="mt-2 text-2xl font-medium tracking-tight text-white">{report.company}</h2>
            <p className="mt-1.5 text-sm text-gray-400">
              {report.periodLabel} · {report.restaurantsAnalyzed} restaurantes analizados
            </p>
            <p className="mt-1 text-xs text-gray-600">{report.brandLabel}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500">Estado general:</span>
              <span className={`${metricPill} ${STATUS_PILL[report.status]}`}>
                {getStatusIcon(report.status)} {getStatusLabel(report.status)}
              </span>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">En objetivo</p>
                <p className="mt-1 text-xl font-light tabular-nums text-emerald-300">
                  {report.summary.onTarget}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">Vigilancia</p>
                <p className="mt-1 text-xl font-light tabular-nums text-amber-200">
                  {report.summary.onWatch}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">En riesgo</p>
                <p className="mt-1 text-xl font-light tabular-nums text-red-300">
                  {report.summary.atRisk}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => onView(report)} className={btnPrimary}>
            Ver informe
          </button>
          <button type="button" onClick={() => onDownload(report)} className={btnOutline}>
            Descargar PDF
          </button>
          <button type="button" onClick={() => onEmail(report)} className={btnOutline}>
            Enviar por email
          </button>
        </div>
      </div>
    </div>
  );
}
