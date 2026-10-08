import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAlert, sampleMonthlyReport } from "@/lib/render/fixtures.test-helper";

const generateMonthlyPdf = vi.fn();
const generateMonthlyPng = vi.fn();
const captureNetworkSummaryPng = vi.fn();
const captureNegativeReviewAlertPng = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/reports/monthly/pdf", () => ({ generateMonthlyPdf }));
vi.mock("@/lib/reports/monthly/image/capture", () => ({ generateMonthlyPng }));
vi.mock("@/lib/reports/network-summary/capture-image", () => ({ captureNetworkSummaryPng }));
vi.mock("@/lib/templates/negative-review-alert/capture-image", () => ({ captureNegativeReviewAlertPng }));

const { executeRender } = await import("@/lib/render/renderer.server");

const PDF = Buffer.from("%PDF");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const ORIGIN = "https://app.nexo.example";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "app.nexo.example";
  delete process.env.NEXO_INTERNAL_ORIGIN;
  generateMonthlyPdf.mockResolvedValue(PDF);
  generateMonthlyPng.mockResolvedValue(PNG);
  captureNetworkSummaryPng.mockResolvedValue(PNG);
  captureNegativeReviewAlertPng.mockResolvedValue(PNG);
});

describe("executeRender: cada operación usa el generador de siempre", () => {
  it("monthly_pdf → generateMonthlyPdf, PDF", async () => {
    const report = sampleMonthlyReport();
    expect(await executeRender({ op: "monthly_pdf", report })).toEqual({ contentType: "application/pdf", body: PDF });
    expect(generateMonthlyPdf).toHaveBeenCalledWith(report);
    expect(generateMonthlyPng).not.toHaveBeenCalled();
  });

  it("monthly_image → generateMonthlyPng, PNG", async () => {
    const report = sampleMonthlyReport();
    expect(await executeRender({ op: "monthly_image", report })).toEqual({ contentType: "image/png", body: PNG });
    expect(generateMonthlyPng).toHaveBeenCalledWith(report);
  });

  it("negative_review_image y whatsapp_alert_image → captura de la alerta con el origen del servidor", async () => {
    const data = sampleAlert();
    for (const op of ["negative_review_image", "whatsapp_alert_image"] as const) {
      captureNegativeReviewAlertPng.mockClear();
      expect(await executeRender({ op, data })).toEqual({ contentType: "image/png", body: PNG });
      expect(captureNegativeReviewAlertPng).toHaveBeenCalledWith(data, { assetBaseUrl: ORIGIN, allowedOrigin: ORIGIN });
    }
  });

  it("network_summary_image → captura de la plantilla de red con el origen del servidor", async () => {
    expect(await executeRender({ op: "network_summary_image", periodo: "trimestral", grupo: "sg-es", offset: 2 })).toEqual({
      contentType: "image/png",
      body: PNG,
    });
    expect(captureNetworkSummaryPng).toHaveBeenCalledWith("trimestral", "sg-es", ORIGIN, 2, { allowedOrigin: ORIGIN });
  });

  it("el origen sale del entorno del servidor: no hay forma de pasarlo en la petición", async () => {
    process.env.NEXO_INTERNAL_ORIGIN = "https://render.nexo.example";
    await executeRender({ op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0 });
    expect(captureNetworkSummaryPng.mock.calls[0]![2]).toBe("https://render.nexo.example");
    expect(executeRender.length).toBe(1); // un único parámetro: la petición ya validada
  });

  it("un fallo del generador se propaga con su mensaje", async () => {
    generateMonthlyPdf.mockRejectedValue(new Error("Chromium no arrancó"));
    await expect(executeRender({ op: "monthly_pdf", report: sampleMonthlyReport() })).rejects.toThrow("Chromium no arrancó");
  });
});
