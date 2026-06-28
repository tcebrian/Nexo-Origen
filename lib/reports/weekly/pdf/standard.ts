import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import type { WeeklyReportData } from "../types";
import { loadHeaderImageBase64 } from "./assets";
import {
  drawDonutChart,
  drawKpiCard,
  drawNegativeReasonsList,
  drawPageFooter,
  drawStatusDot,
  formatPercent,
  formatRating,
  statusLabel,
} from "./draw";

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;

export function renderStandardWeeklyPdf(doc: jsPDF, data: WeeklyReportData) {
  const theme = data.theme;
  doc.setFillColor(...theme.pageBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  drawHeader(doc, data);
  drawKpiRow(doc, data);

  const contentTop = 72;
  drawLocationsTable(doc, data, contentTop);
  drawNegativeSection(doc, data, contentTop);
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(220, 220, 225);
  doc.text("INFORME SEMANAL", MARGIN, 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...theme.titleColor);
  doc.text(theme.brandTitle, MARGIN, 17);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(theme.brandSubtitle, MARGIN, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 205);
  doc.text(`📍 ${theme.networkLabel}`, MARGIN, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("nexo origen", PAGE_W - MARGIN - 108, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("INTELIGENCIA QUE GENERA RESULTADOS", PAGE_W - MARGIN - 108, 13);

  doc.setFillColor(0, 0, 0);
  doc.roundedRect(MARGIN, 30, 118, 7, 1, 1, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...theme.titleColor);
  doc.text(`Fecha de elaboración: ${data.periodLabel}`, MARGIN + 3, 35);
}

function drawKpiRow(doc: jsPDF, data: WeeklyReportData) {
  const theme = data.theme;
  const y = 42;
  const gap = 4;
  const cardW = (PAGE_W - MARGIN * 2 - gap * 3) / 4;
  const cardH = 26;

  const belowSubtitle =
    data.kpis.belowTargetLocations.length > 0
      ? `Locales: ${data.kpis.belowTargetLocations.join(", ")}`
      : data.kpis.belowTargetNote ?? "Todos los locales en objetivo";

  drawKpiCard(
    doc,
    MARGIN,
    y,
    cardW,
    cardH,
    "Impacto en media semanal",
    String(data.kpis.belowTargetCount),
    belowSubtitle,
    theme.accentColor
  );

  drawKpiCard(
    doc,
    MARGIN + cardW + gap,
    y,
    cardW,
    cardH,
    "Nº de reseñas",
    String(data.kpis.totalReviews),
    "Total de reseñas esta semana",
    theme.kpiAccent
  );

  drawKpiCard(
    doc,
    MARGIN + (cardW + gap) * 2,
    y,
    cardW,
    cardH,
    "Reseñas negativas",
    String(data.kpis.negativeReviews),
    `${formatPercent(data.kpis.negativePercent)} del total`,
    [220, 55, 50]
  );

  drawKpiCard(
    doc,
    MARGIN + (cardW + gap) * 3,
    y,
    cardW,
    cardH,
    "Media semanal",
    formatRating(data.kpis.weeklyAverage),
    `Sobre 5 estrellas · Objetivo: ${formatRating(data.kpis.targetAverage)}`,
    theme.kpiAccent
  );
}

function drawLocationsTable(doc: jsPDF, data: WeeklyReportData, startY: number) {
  const theme = data.theme;
  const tableW = theme.multiBrand ? 168 : 175;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 45);
  doc.text("TABLA DE LOCALES", MARGIN, startY);

  const head = theme.multiBrand
    ? [["Marca", "Local", "Media semanal", "Nº reseñas", "Estado", "Motivo principal"]]
    : [["Local", "Media semanal", "Nº reseñas", "Estado", "Motivo"]];

  const body = data.locations.map((row) => {
    const rating = formatRating(row.weeklyRating);
    const status = statusLabel(row.status);
    if (theme.multiBrand) {
      return [
        row.brandLabel ?? "—",
        row.name,
        rating,
        String(row.reviewCount),
        status,
        row.reason,
      ];
    }
    return [row.name, rating, String(row.reviewCount), status, row.reason];
  });

  autoTable(doc, {
    startY: startY + 3,
    margin: { left: MARGIN, right: PAGE_W - MARGIN - tableW - 8 },
    tableWidth: tableW,
    head,
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [45, 45, 50],
      lineColor: [220, 220, 225],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: theme.tableHeaderBg,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [252, 252, 254] },
    columnStyles: theme.multiBrand
      ? { 0: { cellWidth: 22 }, 5: { cellWidth: 42 } }
      : { 4: { cellWidth: 48 } },
    didDrawCell: (hook) => {
      if (theme.multiBrand && hook.section === "body" && hook.column.index === 4) {
        const row = data.locations[hook.row.index];
        if (row) drawStatusDot(doc, hook.cell.x + 3, hook.cell.y + hook.cell.height / 2, row.status);
      }
      if (!theme.multiBrand && hook.section === "body" && hook.column.index === 3) {
        const row = data.locations[hook.row.index];
        if (row) drawStatusDot(doc, hook.cell.x + 3, hook.cell.y + hook.cell.height / 2, row.status);
      }
    },
  });

  const legendY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 80;
  doc.setFontSize(6.5);
  doc.setTextColor(110, 110, 118);
  doc.text(
    "● ≥ 4,4 Objetivo  ·  ● 4,0–4,39 Alerta  ·  ● < 4,0 Riesgo  ·  ● Sin reseñas",
    MARGIN,
    legendY + 5
  );
}

function drawNegativeSection(doc: jsPDF, data: WeeklyReportData, startY: number) {
  const panelX = PAGE_W - MARGIN - 108;
  const panelW = 108;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 45);
  doc.text("% DE RESEÑAS NEGATIVAS", panelX, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 55, 50);
  doc.text(
    `Total reseñas negativas: ${data.kpis.negativeReviews} (${formatPercent(data.kpis.negativePercent)} del total)`,
    panelX,
    startY + 5
  );

  doc.setDrawColor(220, 220, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(panelX, startY + 8, panelW, 118, 2, 2, "FD");

  if (data.negativeReasons.length > 0) {
    drawDonutChart(doc, panelX + 28, startY + 48, 18, 10, data.negativeReasons);
    drawNegativeReasonsList(doc, panelX + 52, startY + 22, panelW - 56, data.negativeReasons);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 128);
    doc.text("Sin reseñas negativas esta semana", panelX + 8, startY + 50);
  }

  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 138);
  doc.text(
    `Los porcentajes se calculan sobre el total de reseñas negativas (${data.kpis.negativeReviews}).`,
    panelX + 4,
    startY + 122
  );
}
