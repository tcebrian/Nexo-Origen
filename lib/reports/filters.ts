import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { LibrarySection, ReportFilters, ReportRecord } from "./types";

export function filterReports(records: ReportRecord[], filters: ReportFilters) {
  return records.filter((record) => {
    if (filters.type !== "todos" && record.type !== filters.type) return false;
    if (filters.brand !== "todas" && record.brand !== filters.brand && record.brand !== "todas") {
      return false;
    }
    return true;
  });
}

export function filterByDateRange(records: ReportRecord[], start: Date, end: Date) {
  return records.filter((r) => r.date >= start && r.date <= end);
}

export function groupLibrary(records: ReportRecord[]) {
  const sections: Record<LibrarySection, ReportRecord[]> = {
    semanal: [],
    mensual: [],
    trimestral: [],
  };

  for (const record of records) {
    if (record.librarySection) {
      sections[record.librarySection].push(record);
    }
  }

  for (const key of Object.keys(sections) as LibrarySection[]) {
    sections[key].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  return sections;
}

export function getStatusLabel(status: ReportRecord["status"]) {
  const map = {
    stable: "Estable",
    attention: "Vigilancia",
    risk: "Riesgo",
  } as const;
  return map[status];
}

export function getStatusIcon(status: ReportRecord["status"]) {
  const map = {
    stable: "🟢",
    attention: "🟡",
    risk: "🔴",
  } as const;
  return map[status];
}

export function getReportTypeLabel(type: ReportRecord["type"]) {
  const map = {
    semanal: "Semanal",
    mensual: "Mensual",
    trimestral: "Trimestral",
    prevent: "Prevent",
    restaurante: "Restaurante",
  } as const;
  return map[type];
}

export type { BrandId };
