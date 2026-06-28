import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import type { TimHortonsLocationCard, WeeklyReportData } from "../types";
import { loadHeaderImageBase64 } from "./assets";
import { drawKpiCard, drawPageFooter, formatPercent, formatRating } from "./draw";

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;

export function renderTimHortonsWeeklyPdf(doc: jsPDF, data: WeeklyReportData) {
  const comparison = data.comparison;
  if (!comparison) return;

  const theme = data.theme;
  doc.setFillColor(...theme.pageBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  drawHeader(doc, data);

  const cardY = 44;
  const cardW = (PAGE_W - MARGIN * 2 - 20) / 2;
  drawLocationCard(doc, MARGIN, cardY, cardW, comparison.locationA, theme.accentColor);
  drawLocationCard(doc, MARGIN + cardW + 20, cardY, cardW, comparison.locationB, theme.tableHeaderBg);

  doc.setFillColor(...theme.accentColor);
  doc.circle(PAGE_W / 2, cardY + 22, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("VS", PAGE_W / 2, cardY + 24, { align: "center" });

  const tableY = cardY + 52;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(...theme.tableHeaderBg);
  doc.rect(MARGIN, tableY, PAGE_W - MARGIN * 2, 8, "F");
  doc.text("INDICADORES CLAVE DE LA SEMANA", MARGIN + 4, tableY + 5.5);

  autoTable(doc, {
    startY: tableY + 8,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Indicador", comparison.locationA.name, comparison.locationB.name, "Comparativa"]],
    body: [
      [
        "Media semanal",
        formatRating(comparison.locationA.weeklyRating),
        formatRating(comparison.locationB.weeklyRating),
        comparison.comparisonSummary,
      ],
      [
        "Total reseñas",
        String(comparison.locationA.totalReviews),
        String(comparison.locationB.totalReviews),
        "",
      ],
      [
        "Reseñas negativas",
        String(comparison.locationA.negativeReviews),
        String(comparison.locationB.negativeReviews),
        "",
      ],
      [
        "% Reseñas positivas",
        formatPercent(comparison.locationA.positivePercent),
        formatPercent(comparison.locationB.positivePercent),
        "",
      ],
    ],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: theme.tableHeaderBg, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 38 },
      3: { cellWidth: 72 },
    },
  });

  const bottomY = tableY + 58;
  drawHighlights(doc, MARGIN, bottomY, 88, comparison);
  drawConclusions(doc, MARGIN + 94, bottomY, 88, comparison);
  drawFranchiseSummary(doc, MARGIN + 188, bottomY, 89, comparison, data);

  drawPageFooter(doc, PAGE_W, PAGE_H, data.footerMonthLabel, MARGIN);
}

function drawHeader(doc: jsPDF, data: WeeklyReportData) {
  const theme = data.theme;
  const headerH = 36;

  doc.setFillColor(...theme.headerBg);
  doc.rect(0, 0, PAGE_W, headerH, "F");

  const headerImg = loadHeaderImageBase64(theme.headerImage);
  if (headerImg) {
    doc.addImage(headerImg, "PNG", PAGE_W - 108, 0, 108, headerH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...theme.titleColor);
  doc.text(theme.brandTitle, MARGIN, 14);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(theme.brandSubtitle, MARGIN, 20);

  doc.setFillColor(0, 0, 0);
  doc.roundedRect(MARGIN, 24, 130, 7, 1, 1, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...theme.titleColor);
  doc.text(`Datos de la semana del ${data.periodLabel}`, MARGIN + 3, 29);
}

function drawLocationCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  location: TimHortonsLocationCard,
  headerColor: [number, number, number]
) {
  doc.setDrawColor(220, 220, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, 46, 2, 2, "FD");

  doc.setFillColor(...headerColor);
  doc.roundedRect(x, y, w, 10, 2, 2, "F");
  doc.rect(x, y + 6, w, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  const nameLines = doc.splitTextToSize(location.name.toUpperCase(), w - 8) as string[];
  doc.text(nameLines[0] ?? "", x + 4, y + 6.5);

  drawKpiCard(doc, x + 3, y + 12, (w - 8) / 3 - 1, 30, "Media", formatRating(location.weeklyRating), "Valoración semanal", headerColor);
  drawKpiCard(
    doc,
    x + 3 + (w - 8) / 3,
    y + 12,
    (w - 8) / 3 - 1,
    30,
    "Reseñas",
    String(location.totalReviews),
    "Total recibidas",
    headerColor
  );
  drawKpiCard(
    doc,
    x + 3 + ((w - 8) / 3) * 2,
    y + 12,
    (w - 8) / 3 - 1,
    30,
    "Negativas",
    String(location.negativeReviews),
    location.negativeReviews === 0 ? "Sin negativas" : "A vigilar",
    [220, 55, 50]
  );
}

function drawHighlights(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  comparison: NonNullable<WeeklyReportData["comparison"]>
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 45);
  doc.text("Aspectos destacados", x, y);

  let rowY = y + 5;
  comparison.highlights.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(200, 16, 46);
    doc.text(`• ${item.title}`, x, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 98);
    const lines = doc.splitTextToSize(item.description, w) as string[];
    doc.text(lines[0] ?? "", x + 2, rowY + 4);
    rowY += 10;
  });
}

function drawConclusions(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  comparison: NonNullable<WeeklyReportData["comparison"]>
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 45);
  doc.text("Conclusiones", x, y);

  let rowY = y + 5;
  comparison.conclusions.forEach((line) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 78);
    const lines = doc.splitTextToSize(`✓ ${line}`, w) as string[];
    lines.forEach((l, i) => doc.text(l, x, rowY + i * 4));
    rowY += lines.length * 4 + 2;
  });
}

function drawFranchiseSummary(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  comparison: NonNullable<WeeklyReportData["comparison"]>,
  data: WeeklyReportData
) {
  const summary = comparison.franchiseSummary;
  doc.setDrawColor(220, 220, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, 52, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 45);
  doc.text("Resumen franquicia", x + 4, y + 7);

  const rows = [
    ["Media global", formatRating(summary.globalRating)],
    ["Total reseñas", String(summary.totalReviews)],
    ["Reseñas negativas", String(summary.negativeReviews)],
    ["% Positivas", formatPercent(summary.positivePercent)],
  ];

  let rowY = y + 12;
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 108);
    doc.text(label, x + 4, rowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 45);
    doc.text(value, x + w - 4, rowY, { align: "right" });
    rowY += 8;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 138);
  doc.text(data.theme.networkLabel, x + 4, y + 48);
}
