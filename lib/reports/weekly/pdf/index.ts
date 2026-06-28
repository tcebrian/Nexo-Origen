import type { jsPDF } from "jspdf";
import type { WeeklyReportData } from "../types";
import { renderStandardWeeklyPdf } from "./standard";
import { renderTimHortonsWeeklyPdf } from "./tim-hortons";

async function loadJsPDF() {
  return import("jspdf");
}

export async function createWeeklyReportPdf(data: WeeklyReportData): Promise<jsPDF> {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "landscape",
  });

  if (data.templateId === "tim-hortons") {
    renderTimHortonsWeeklyPdf(doc, data);
  } else {
    renderStandardWeeklyPdf(doc, data);
  }

  return doc;
}

export async function weeklyReportToArrayBuffer(data: WeeklyReportData): Promise<ArrayBuffer> {
  const doc = await createWeeklyReportPdf(data);
  const buffer = doc.output("arraybuffer");
  return buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(0);
}
