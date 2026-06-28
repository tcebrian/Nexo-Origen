import type { jsPDF } from "jspdf";
import type { NegativeReasonSegment, WeeklyLocationStatus } from "../types";

type RGB = [number, number, number];

export function formatRating(value: number | null) {
  if (value === null) return "—";
  return value.toFixed(2).replace(".", ",");
}

export function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function statusLabel(status: WeeklyLocationStatus) {
  switch (status) {
    case "on_target":
      return "Objetivo alcanzado";
    case "watch":
      return "En alerta";
    case "risk":
      return "En riesgo";
    default:
      return "Sin reseñas";
  }
}

export function statusColor(status: WeeklyLocationStatus): RGB {
  switch (status) {
    case "on_target":
      return [34, 160, 90];
    case "watch":
      return [230, 170, 40];
    case "risk":
      return [220, 55, 50];
    default:
      return [160, 160, 165];
  }
}

export function drawStatusDot(doc: jsPDF, x: number, y: number, status: WeeklyLocationStatus) {
  const [r, g, b] = statusColor(status);
  doc.setFillColor(r, g, b);
  doc.circle(x, y, 1.2, "F");
}

export function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  value: string,
  subtitle: string,
  accent: RGB
) {
  doc.setDrawColor(220, 220, 225);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 110);
  doc.text(title.toUpperCase(), x + 4, y + 7);

  doc.setFontSize(18);
  doc.setTextColor(...accent);
  doc.text(value, x + 4, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 98);
  const lines = doc.splitTextToSize(subtitle, w - 8) as string[];
  lines.forEach((line, i) => doc.text(line, x + 4, y + 24 + i * 4));
}

function drawPieSlice(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  color: RGB
) {
  doc.setFillColor(...color);
  const steps = Math.max(8, Math.ceil(Math.abs(endDeg - startDeg) / 6));
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;

  for (let i = 0; i < steps; i++) {
    const a1 = start + ((end - start) * i) / steps;
    const a2 = start + ((end - start) * (i + 1)) / steps;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    doc.triangle(cx, cy, x1, y1, x2, y2, "F");
  }
}

export function drawDonutChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  segments: NegativeReasonSegment[]
) {
  const total = segments.reduce((sum, seg) => sum + seg.count, 0);
  if (total === 0) return;

  let angle = -90;
  segments.forEach((seg) => {
    const sweep = (seg.count / total) * 360;
    drawPieSlice(doc, cx, cy, outerR, angle, angle + sweep, seg.color);
    angle += sweep;
  });

  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, innerR, "F");
}

export function drawNegativeReasonsList(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  segments: NegativeReasonSegment[]
) {
  let rowY = y;
  segments.forEach((seg) => {
    doc.setFillColor(...seg.color);
    doc.roundedRect(x, rowY + 1, 3, 3, 0.5, 0.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 45);
    doc.text(seg.label, x + 5, rowY + 3.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 108);
    doc.text(
      `${formatPercent(seg.percent)} · ${seg.count} reseña${seg.count === 1 ? "" : "s"}`,
      x + 5,
      rowY + 8
    );

    rowY += 12;
  });
}

export function drawPageFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  monthLabel: string,
  margin: number
) {
  const y = pageH - 8;
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y - 4, pageW - margin, y - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 128);
  doc.text(`Fuente: Google Maps (Reseñas) | Nexo Origen – ${monthLabel}`, margin, y);
  doc.text("www.nexoorigen.com", pageW - margin, y, { align: "right" });
}
