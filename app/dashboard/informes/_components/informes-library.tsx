"use client";

import { getReportTypeLabel, getStatusIcon, getStatusLabel } from "@/lib/reports/filters";
import type { LibrarySection, ReportRecord } from "@/lib/reports/types";
import { btnGhost, cardInteractive, sectionPad, shell, textKicker, textTitle } from "./ui/informes-styles";

type InformesLibraryProps = {
  sections: Record<LibrarySection, ReportRecord[]>;
  onView: (report: ReportRecord) => void;
  onDownload: (report: ReportRecord) => void;
  onEmail: (report: ReportRecord) => void;
};

const SECTION_META: { key: LibrarySection; icon: string; title: string }[] = [
  { key: "semanal", icon: "📅", title: "Semanales" },
  { key: "mensual", icon: "📆", title: "Mensuales" },
  { key: "trimestral", icon: "📈", title: "Trimestrales" },
];

function formatDate(date: Date) {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function LibraryItem({
  report,
  onView,
  onDownload,
  onEmail,
}: {
  report: ReportRecord;
  onView: (r: ReportRecord) => void;
  onDownload: (r: ReportRecord) => void;
  onEmail: (r: ReportRecord) => void;
}) {
  return (
    <div className={`${cardInteractive} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-100">{report.periodLabel}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {getReportTypeLabel(report.type)} · {report.brandLabel} · {formatDate(report.date)}
        </p>
        <p className="mt-1.5 text-xs text-gray-600">
          {getStatusIcon(report.status)} {getStatusLabel(report.status)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <button type="button" onClick={() => onView(report)} className={btnGhost}>
          Ver
        </button>
        <button type="button" onClick={() => onDownload(report)} className={btnGhost}>
          PDF
        </button>
        <button type="button" onClick={() => onEmail(report)} className={btnGhost}>
          Enviar
        </button>
      </div>
    </div>
  );
}

export function InformesLibrary({ sections, onView, onDownload, onEmail }: InformesLibraryProps) {
  const hasItems = SECTION_META.some((s) => sections[s.key].length > 0);

  return (
    <div className={shell}>
      <div className={sectionPad}>
        <p className={textKicker}>Biblioteca</p>
        <h2 className={`mt-1.5 ${textTitle}`}>Informes anteriores</h2>
        <p className="mt-1 text-sm text-gray-500">Organizados por periodo. Sin carpetas ni tablas.</p>
      </div>

      {!hasItems ? (
        <p className="border-t border-white/[0.06] px-6 py-12 text-center text-sm text-gray-500">
          No hay informes con los filtros actuales.
        </p>
      ) : (
        <div className="space-y-6 border-t border-white/[0.06] p-4 lg:p-6">
          {SECTION_META.map((section) => {
            const items = sections[section.key];
            if (items.length === 0) return null;

            return (
              <div key={section.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span aria-hidden>{section.icon}</span>
                  <h3 className="text-sm font-medium text-gray-300">{section.title}</h3>
                  <span className="text-xs text-gray-600">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((report) => (
                    <LibraryItem
                      key={report.id}
                      report={report}
                      onView={onView}
                      onDownload={onDownload}
                      onEmail={onEmail}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
