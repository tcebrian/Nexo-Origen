import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { buildWeeklyReportFromKpi } from "@/lib/reports/weekly/build-from-kpi";
import type { WeeklyTemplateId } from "@/lib/reports/weekly/types";
import { mapEstadoToOperational, marcaToBrandId } from "./kpi-mappers";
import type { KpiRestaurantRow, PeriodQuery } from "./kpi-restaurantes";
import type { ResenaRow } from "./resenas";
import type { AnalisisIaIndex } from "./analisis-ia";
import type { ReportAutomation, ReportRecord } from "@/lib/reports/types";

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function reportStatus(rows: KpiRestaurantRow[]): ReportRecord["status"] {
  const critical = rows.filter((row) => mapEstadoToOperational(row.estado) === "critical").length;
  const watch = rows.filter((row) => mapEstadoToOperational(row.estado) === "watch").length;
  if (critical > 0) return "risk";
  if (watch > 0) return "attention";
  return "stable";
}

function weeklyTemplateForBrand(brand: BrandId): WeeklyTemplateId {
  if (brand === "bk") return "bk";
  if (brand === "sg") return "sg";
  if (brand === "th") return "tim-hortons";
  return "grupo-hambar";
}

export function buildReportsFromKpi(
  rows: KpiRestaurantRow[],
  query: PeriodQuery,
  resenas: ResenaRow[] = [],
  analisisByResenaId: AnalisisIaIndex = new Map()
): ReportRecord[] {
  if (rows.length === 0) return [];

  const onTarget = rows.filter((row) => mapEstadoToOperational(row.estado) === "on_target").length;
  const onWatch = rows.filter((row) => mapEstadoToOperational(row.estado) === "watch").length;
  const atRisk = rows.filter((row) => mapEstadoToOperational(row.estado) === "critical").length;

  const best = [...rows].sort((a, b) => b.media_total - a.media_total)[0];
  const worst = [...rows].sort((a, b) => a.media_total - b.media_total)[0];
  const mostNegatives = [...rows].sort((a, b) => b.resenas_negativas - a.resenas_negativas)[0];

  const express = {
    bestRestaurant: best?.restaurante ?? "Sin datos",
    bestImprovement: best?.restaurante ?? "Sin datos",
    highestRisk: worst?.restaurante ?? "Sin datos",
    preventProtection: Math.round((onTarget / Math.max(rows.length, 1)) * 100),
  };

  const periodLabel = formatPeriodLabel(query.start, query.end);
  const date = query.end;

  const brands = new Map<BrandId, KpiRestaurantRow[]>();
  for (const row of rows) {
    const brand = marcaToBrandId(row.marca);
    if (!brands.has(brand)) brands.set(brand, []);
    brands.get(brand)!.push(row);
  }

  const reports: ReportRecord[] = [
    {
      id: `report-network-${query.end.toISOString().slice(0, 10)}`,
      title: "Informe de red Grupo Hámbar",
      type: "semanal",
      librarySection: "semanal",
      company: "Grupo Hambar",
      brand: "todas",
      brandLabel: "Grupo Hámbar",
      periodLabel,
      date,
      restaurantsAnalyzed: rows.length,
      status: reportStatus(rows),
      summary: { onTarget, onWatch, atRisk },
      express: {
        ...express,
        highestRisk: mostNegatives?.restaurante ?? express.highestRisk,
      },
      weeklyTemplateId: "grupo-hambar",
      weeklyData: buildWeeklyReportFromKpi(rows, "grupo-hambar", query, resenas, analisisByResenaId),
    },
  ];

  for (const [brand, brandRows] of brands) {
    const brandOnTarget = brandRows.filter(
      (row) => mapEstadoToOperational(row.estado) === "on_target"
    ).length;
    const brandWatch = brandRows.filter(
      (row) => mapEstadoToOperational(row.estado) === "watch"
    ).length;
    const brandRisk = brandRows.filter(
      (row) => mapEstadoToOperational(row.estado) === "critical"
    ).length;
    const brandBest = [...brandRows].sort((a, b) => b.media_total - a.media_total)[0];
    const templateId = weeklyTemplateForBrand(brand);

    reports.push({
      id: `report-${brand}-${query.end.toISOString().slice(0, 10)}`,
      title: `Informe ${brandRows[0]?.marca ?? brand}`,
      type: "semanal",
      librarySection: "semanal",
      company: "Grupo Hambar",
      brand,
      brandLabel: brandRows[0]?.marca ?? brand,
      periodLabel,
      date,
      restaurantsAnalyzed: brandRows.length,
      status: reportStatus(brandRows),
      summary: { onTarget: brandOnTarget, onWatch: brandWatch, atRisk: brandRisk },
      express: {
        bestRestaurant: brandBest?.restaurante ?? "Sin datos",
        bestImprovement: brandBest?.restaurante ?? "Sin datos",
        highestRisk: worst?.restaurante ?? "Sin datos",
        preventProtection: Math.round((brandOnTarget / Math.max(brandRows.length, 1)) * 100),
      },
      weeklyTemplateId: templateId,
      weeklyData: buildWeeklyReportFromKpi(rows, templateId, query, resenas, analisisByResenaId),
    });
  }

  return reports;
}

export function buildAutomationsPlaceholder(): ReportAutomation[] {
  return [];
}
