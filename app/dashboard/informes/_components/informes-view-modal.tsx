"use client";

import { getReportTypeLabel, getStatusIcon, getStatusLabel } from "@/lib/reports/filters";
import type { ReportRecord } from "@/lib/reports/types";
import { btnOutline, btnPrimary, shell } from "./ui/informes-styles";

type InformesViewModalProps = {
  report: ReportRecord | null;
  onClose: () => void;
  onDownload: (report: ReportRecord) => void;
  onEmail: (report: ReportRecord) => void;
};

export function InformesViewModal({ report, onClose, onDownload, onEmail }: InformesViewModalProps) {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className={`relative flex max-h-[min(90svh,720px)] w-full max-w-2xl flex-col overflow-hidden ${shell}`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">
              Vista previa
            </p>
            <h2 className="mt-1 text-lg font-medium text-white">
              {report.title} — {report.periodLabel}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {report.company} · {report.brandLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.08] p-2 text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="space-y-4 text-sm leading-relaxed text-gray-300">
            <p>
              <span className="text-gray-500">Estado general:</span>{" "}
              {getStatusIcon(report.status)} {getStatusLabel(report.status)}
            </p>
            <p>
              <span className="text-gray-500">Restaurantes analizados:</span> {report.restaurantsAnalyzed}
            </p>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                Resumen ejecutivo
              </p>
              <ul className="mt-3 space-y-2 text-gray-300">
                <li>🏆 Mejor restaurante: {report.express.bestRestaurant}</li>
                <li>📈 Mayor mejora: {report.express.bestImprovement}</li>
                <li>📉 Mayor riesgo: {report.express.highestRisk}</li>
                <li>🛡️ Nexo Prevent: {report.express.preventProtection}% protegido</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                Distribución de red
              </p>
              <p className="mt-3">
                {report.summary.onTarget} en objetivo · {report.summary.onWatch} en vigilancia ·{" "}
                {report.summary.atRisk} en riesgo
              </p>
            </div>
            <p className="text-xs text-gray-600">
              Tipo: {getReportTypeLabel(report.type)} · Generado el{" "}
              {report.date.toLocaleDateString("es-ES")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.06] px-5 py-4 sm:flex-row">
          <button type="button" onClick={() => onDownload(report)} className={`${btnPrimary} flex-1`}>
            Descargar PDF
          </button>
          <button type="button" onClick={() => onEmail(report)} className={`${btnOutline} flex-1`}>
            Enviar por email
          </button>
        </div>
      </div>
    </div>
  );
}
