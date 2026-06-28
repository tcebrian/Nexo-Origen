import ExcelJS from "exceljs";
import type { Review, ReviewStats } from "./types";

const COLORS = {
  purple: "FF5B21B6",
  purpleDark: "FF3B0764",
  purpleLight: "FFEDE9FE",
  headerText: "FFFFFFFF",
  rowAlt: "FF0F0A18",
  rowBase: "FF1A1028",
  border: "FF3D2E5C",
  emerald: "FF34D399",
  red: "FFF87171",
  amber: "FFFBBF24",
  gray: "FF9CA3AF",
};

type ExportReviewsExcelInput = {
  reviews: Review[];
  stats: ReviewStats;
  tenantName: string;
  periodLabel: string;
};

function getBrandLabel(review: Review) {
  return review.brandLabel || "—";
}

function sentimentLabel(sentiment: Review["sentiment"]) {
  switch (sentiment) {
    case "positiva":
      return "Positiva";
    case "negativa":
      return "Negativa";
    default:
      return "Neutral";
  }
}

function applyHeaderStyle(row: ExcelJS.Row, fillArgb = COLORS.purple) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 11, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  });
}

function applyDataRowStyle(row: ExcelJS.Row, index: number) {
  const fill = index % 2 === 0 ? COLORS.rowBase : COLORS.rowAlt;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.font = { color: { argb: "FFE5E7EB" }, size: 10, name: "Calibri" };
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = {
      top: { style: "hair", color: { argb: COLORS.border } },
      left: { style: "hair", color: { argb: COLORS.border } },
      bottom: { style: "hair", color: { argb: COLORS.border } },
      right: { style: "hair", color: { argb: COLORS.border } },
    };
  });
}

function buildRestaurantSummary(reviews: Review[]) {
  const map = new Map<
    string,
    { restaurant: string; brand: string; total: number; positives: number; negatives: number; sumRating: number }
  >();

  for (const review of reviews) {
    const current = map.get(review.restaurant) ?? {
      restaurant: review.restaurant,
      brand: getBrandLabel(review),
      total: 0,
      positives: 0,
      negatives: 0,
      sumRating: 0,
    };
    current.total += 1;
    current.sumRating += review.rating;
    if (review.sentiment === "positiva") current.positives += 1;
    if (review.sentiment === "negativa") current.negatives += 1;
    map.set(review.restaurant, current);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avg: row.total === 0 ? 0 : row.sumRating / row.total,
      negativePct: row.total === 0 ? 0 : Math.round((row.negatives / row.total) * 100),
    }))
    .sort((a, b) => b.negatives - a.negatives || a.avg - b.avg);
}

async function addSummarySheet(
  workbook: ExcelJS.Workbook,
  input: ExportReviewsExcelInput
) {
  const sheet = workbook.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  });

  sheet.columns = [{ width: 28 }, { width: 22 }, { width: 18 }];

  sheet.mergeCells("A1:C1");
  const title = sheet.getCell("A1");
  title.value = `Informe de reseñas — ${input.tenantName}`;
  title.font = { bold: true, size: 16, color: { argb: COLORS.headerText }, name: "Calibri" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.purpleDark } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 36;

  const metaRows: [string, string][] = [
    ["Periodo analizado", input.periodLabel],
    ["Fecha de exportación", new Date().toLocaleString("es-ES")],
    ["Fuente", "Google Maps"],
    ["Total reseñas", String(input.stats.total)],
    ["Reseñas positivas", `${input.stats.positives} (${input.stats.positivePct}%)`],
    ["Reseñas negativas", `${input.stats.negatives} (${input.stats.negativePct}%)`],
    ["Media de valoración", input.stats.avg],
    ["Sin revisar", String(input.stats.unreviewed)],
  ];

  let rowIndex = 3;
  for (const [label, value] of metaRows) {
    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(1).font = { bold: true, color: { argb: COLORS.gray }, size: 10 };
    row.getCell(2).font = { color: { argb: "FFF3F4F6" }, size: 11 };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.rowAlt } };
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.rowBase } };
    rowIndex += 1;
  }
}

async function addReviewsSheet(workbook: ExcelJS.Workbook, reviews: Review[]) {
  const sheet = workbook.addWorksheet("Reseñas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = [
    "Fecha",
    "Restaurante",
    "Marca",
    "Autor",
    "Valoración",
    "Sentimiento",
    "Texto",
    "Analizada",
    "Prioridad",
    "Motivos",
    "Acción recomendada",
    "Fuente",
    "ID",
  ];

  sheet.columns = [
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 18 },
    { width: 11 },
    { width: 12 },
    { width: 52 },
    { width: 11 },
    { width: 11 },
    { width: 24 },
    { width: 32 },
    { width: 10 },
    { width: 14 },
  ];

  sheet.addRow(headers);
  applyHeaderStyle(sheet.getRow(1));

  const sorted = [...reviews].sort((a, b) => b.date.getTime() - a.date.getTime());

  sorted.forEach((review, index) => {
    const row = sheet.addRow([
      review.date,
      review.restaurant,
      getBrandLabel(review),
      review.author,
      review.rating,
      sentimentLabel(review.sentiment),
      review.text,
      review.ai ? "Sí" : "No",
      review.ai?.priority ?? "—",
      review.ai?.motives?.join(", ") ?? "—",
      review.ai?.recommendedAction ?? "—",
      "Google Maps",
      review.id,
    ]);

    applyDataRowStyle(row, index);

    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(5).numFmt = "0.0";
    row.getCell(5).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(6).alignment = { horizontal: "center", vertical: "top" };

    const sentimentCell = row.getCell(6);
    if (review.sentiment === "positiva") {
      sentimentCell.font = { color: { argb: COLORS.emerald }, bold: true, size: 10 };
    } else if (review.sentiment === "negativa") {
      sentimentCell.font = { color: { argb: COLORS.red }, bold: true, size: 10 };
    }

    const ratingCell = row.getCell(5);
    if (review.rating <= 2) {
      ratingCell.font = { color: { argb: COLORS.red }, bold: true, size: 10 };
    } else if (review.rating >= 4) {
      ratingCell.font = { color: { argb: COLORS.emerald }, bold: true, size: 10 };
    } else {
      ratingCell.font = { color: { argb: COLORS.amber }, bold: true, size: 10 };
    }

    row.height = Math.min(80, Math.max(22, Math.ceil(review.text.length / 70) * 14));
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sorted.length + 1), column: headers.length },
  };
}

async function addRestaurantSheet(workbook: ExcelJS.Workbook, reviews: Review[]) {
  const sheet = workbook.addWorksheet("Por restaurante", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = [
    "Restaurante",
    "Marca",
    "Total reseñas",
    "Positivas",
    "Negativas",
    "% Negativas",
    "Media",
  ];

  sheet.columns = [
    { width: 24 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 10 },
  ];

  sheet.addRow(headers);
  applyHeaderStyle(sheet.getRow(1), COLORS.purpleDark);

  const summary = buildRestaurantSummary(reviews);
  summary.forEach((item, index) => {
    const row = sheet.addRow([
      item.restaurant,
      item.brand,
      item.total,
      item.positives,
      item.negatives,
      item.negativePct / 100,
      item.avg,
    ]);
    applyDataRowStyle(row, index);
    row.getCell(6).numFmt = "0%";
    row.getCell(7).numFmt = "0.00";
    row.getCell(3).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };

    if (item.negatives > 0) {
      row.getCell(5).font = { color: { argb: COLORS.red }, bold: true, size: 10 };
    }
  });
}

export async function exportReviewsToExcel(input: ExportReviewsExcelInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nexo Origen";
  workbook.created = new Date();
  workbook.modified = new Date();

  await addSummarySheet(workbook, input);
  await addReviewsSheet(workbook, input.reviews);
  await addRestaurantSheet(workbook, input.reviews);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const slug = input.tenantName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `reseñas-${slug}-${dateStamp}.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
