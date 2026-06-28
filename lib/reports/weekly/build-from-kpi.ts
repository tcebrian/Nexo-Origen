import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { REPUTATION_TARGET } from "@/lib/restaurants/metrics";
import { getTopReasons } from "@/lib/review-metrics";
import { mapEstadoToOperational, marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { WEEKLY_THEMES } from "./themes";
import type {
  NegativeReasonSegment,
  WeeklyLocationRow,
  WeeklyLocationStatus,
  WeeklyReportData,
  WeeklyTemplateId,
} from "./types";

const NEGATIVE_COLORS: [number, number, number][] = [
  [255, 130, 0],
  [55, 55, 60],
  [120, 120, 125],
  [255, 180, 60],
  [180, 80, 80],
];

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function formatFooterMonth(date: Date): string {
  const label = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function filterRowsForTemplate(
  rows: KpiRestaurantRow[],
  templateId: WeeklyTemplateId
): KpiRestaurantRow[] {
  if (templateId === "grupo-hambar") return rows;
  if (templateId === "bk") return rows.filter((row) => marcaToBrandId(row.marca) === "bk");
  if (templateId === "sg") return rows.filter((row) => marcaToBrandId(row.marca) === "sg");
  if (templateId === "tim-hortons") return rows.filter((row) => marcaToBrandId(row.marca) === "th");
  return rows;
}

function toWeeklyStatus(row: KpiRestaurantRow): WeeklyLocationStatus {
  const status = mapEstadoToOperational(row.estado);
  if (row.total_resenas === 0) return "no_reviews";
  if (status === "critical") return "risk";
  if (status === "watch") return "watch";
  return "on_target";
}

function shortLocationName(name: string): string {
  return name.replace(/^(BK|Burger King|Popeyes|Santa Gloria|Tim Hortons|Ribs|Sibuya|Taberna Volapie)\s+/i, "").trim() || name;
}

function buildNegativeReasons(resenas: ResenaRow[], analisisByResenaId: AnalisisIaIndex): NegativeReasonSegment[] {
  return getTopReasons(resenas, analisisByResenaId, { negativesOnly: true, limit: 5 }).map(
    (item, index) => ({
      label: item.motivo,
      count: item.count,
      percent: item.percent,
      color: NEGATIVE_COLORS[index % NEGATIVE_COLORS.length],
    })
  );
}

function buildLocations(rows: KpiRestaurantRow[]): WeeklyLocationRow[] {
  return rows
    .map((row) => {
      const status = toWeeklyStatus(row);
      const brandId = marcaToBrandId(row.marca);
      let reason = "Sin reseñas negativas";
      if (status === "risk") reason = "Media bajo objetivo";
      else if (status === "watch") reason = "Vigilancia activa";
      else if (status === "no_reviews") reason = "Sin actividad en el periodo";

      return {
        name: shortLocationName(row.restaurante),
        brandId,
        brandLabel: row.marca,
        weeklyRating: row.total_resenas > 0 ? row.media_total : null,
        reviewCount: row.total_resenas,
        status,
        reason,
      };
    })
    .sort((a, b) => (b.weeklyRating ?? 0) - (a.weeklyRating ?? 0));
}

export function buildWeeklyReportFromKpi(
  allRows: KpiRestaurantRow[],
  templateId: WeeklyTemplateId,
  query: { start: Date; end: Date },
  resenas: ResenaRow[] = [],
  analisisByResenaId: AnalisisIaIndex = new Map()
): WeeklyReportData {
  const rows = filterRowsForTemplate(allRows, templateId);
  const totalReviews = rows.reduce((sum, row) => sum + row.total_resenas, 0);
  const negativeReviews = rows.reduce((sum, row) => sum + row.resenas_negativas, 0);
  const weightedMedia =
    totalReviews > 0
      ? rows.reduce((sum, row) => sum + row.media_total * row.total_resenas, 0) / totalReviews
      : 0;

  const belowTarget = rows.filter((row) => row.media_total < REPUTATION_TARGET && row.total_resenas > 0);

  const filteredResenas =
    templateId === "grupo-hambar"
      ? resenas
      : resenas.filter((row) => {
          const brand = row.marca ? marcaToBrandId(row.marca) : null;
          const templateBrand: BrandId | null =
            templateId === "bk"
              ? "bk"
              : templateId === "sg"
                ? "sg"
                : templateId === "tim-hortons"
                  ? "th"
                  : null;
          return brand === templateBrand;
        });

  return {
    templateId,
    theme: WEEKLY_THEMES[templateId],
    periodLabel: formatPeriodLabel(query.start, query.end),
    periodStart: query.start,
    periodEnd: query.end,
    kpis: {
      belowTargetCount: belowTarget.length,
      belowTargetLocations: belowTarget.map((row) => shortLocationName(row.restaurante)),
      totalReviews,
      negativeReviews,
      negativePercent:
        totalReviews > 0 ? Math.round((negativeReviews / totalReviews) * 1000) / 10 : 0,
      weeklyAverage: Math.round(weightedMedia * 100) / 100,
      targetAverage: REPUTATION_TARGET,
    },
    locations: buildLocations(rows),
    negativeReasons: buildNegativeReasons(filteredResenas, analisisByResenaId),
    footerMonthLabel: formatFooterMonth(query.end),
  };
}
