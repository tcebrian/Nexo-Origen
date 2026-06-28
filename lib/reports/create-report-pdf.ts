import "server-only";

import { getReportTypeLabel, getStatusLabel } from "./filters";
import type { ReportRecord } from "./types";
import { resolveWeeklyReportData } from "./weekly/resolve";
import { createWeeklyReportPdf } from "./weekly/pdf";

const PURPLE: [number, number, number] = [109, 40, 217];
const DARK: [number, number, number] = [30, 30, 35];
const MUTED: [number, number, number] = [100, 100, 110];
const PAGE_W = 210;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

type JsPDFInstance = InstanceType<Awaited<ReturnType<typeof loadJsPDF>>["jsPDF"]>;

async function loadJsPDF() {
  return import("jspdf");
}

function normalizeReport(report: ReportRecord): ReportRecord {
  return {
    ...report,
    date: report.date instanceof Date ? report.date : new Date(report.date),
  };
}

function wrapText(
  doc: JsPDFInstance,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

async function createLegacyReportPdf(data: ReportRecord): Promise<JsPDFInstance> {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = MARGIN;

  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, PAGE_W, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PURPLE);
  doc.text("NEXO ORIGEN", MARGIN, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Informe ejecutivo de reputación", MARGIN, y + 10);

  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(data.title, MARGIN, y);

  y += 9;
  doc.setFontSize(14);
  doc.text(data.company, MARGIN, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(
    `${data.periodLabel}  ·  ${data.brandLabel}  ·  ${data.restaurantsAnalyzed} restaurantes`,
    MARGIN,
    y
  );

  y += 6;
  doc.setFontSize(10);
  doc.text(
    `Tipo: ${getReportTypeLabel(data.type)}  ·  Generado: ${data.date.toLocaleDateString("es-ES")}`,
    MARGIN,
    y
  );

  y += 14;
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Estado general de la red", MARGIN, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(getStatusLabel(data.status), MARGIN, y);

  y += 10;
  const stats = [
    { label: "En objetivo", value: String(data.summary.onTarget) },
    { label: "En vigilancia", value: String(data.summary.onWatch) },
    { label: "En riesgo", value: String(data.summary.atRisk) },
  ];

  const colW = CONTENT_W / 3;
  stats.forEach((stat, index) => {
    const x = MARGIN + index * colW;
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x, y, colW - 4, 22, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(stat.label.toUpperCase(), x + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...DARK);
    doc.text(stat.value, x + 4, y + 17);
    doc.setFont("helvetica", "normal");
  });

  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Resumen express", MARGIN, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);

  const expressLines = [
    `Mejor restaurante: ${data.express.bestRestaurant}`,
    `Mayor mejora: ${data.express.bestImprovement}`,
    `Mayor riesgo: ${data.express.highestRisk}`,
    `Nexo Prevent: ${data.express.preventProtection}% de protección global`,
  ];

  expressLines.forEach((line) => {
    doc.text(`•  ${line}`, MARGIN + 2, y);
    y += 7;
  });

  y += 6;
  doc.setFillColor(245, 243, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PURPLE);
  doc.text("NOTA EJECUTIVA", MARGIN + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const note =
    `Durante ${data.periodLabel}, ${data.summary.onTarget} de ${data.restaurantsAnalyzed} locales ` +
    `mantienen el objetivo de reputación. Se recomienda priorizar la actuación en ${data.express.highestRisk} ` +
    `y replicar las buenas prácticas observadas en ${data.express.bestRestaurant}.`;

  wrapText(doc, note, MARGIN + 5, y + 15, CONTENT_W - 10, 5);

  const footerY = 287;
  doc.setDrawColor(230, 230, 235);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 6, MARGIN + CONTENT_W, footerY - 6);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Nexo Origen · Confidencial · Uso interno", MARGIN, footerY);
  doc.text(`ID: ${data.id}`, MARGIN + CONTENT_W, footerY, { align: "right" });

  return doc;
}

export async function createReportPdf(report: ReportRecord): Promise<JsPDFInstance> {
  const data = normalizeReport(report);
  const weekly = resolveWeeklyReportData(data);
  if (weekly) {
    return createWeeklyReportPdf(weekly);
  }
  return createLegacyReportPdf(data);
}

export async function reportPdfToArrayBuffer(report: ReportRecord): Promise<ArrayBuffer> {
  const doc = await createReportPdf(report);
  const buffer = doc.output("arraybuffer");
  return buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(0);
}
