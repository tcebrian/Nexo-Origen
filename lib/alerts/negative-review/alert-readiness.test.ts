import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ALERT_CANVAS_SIZES, DESIGN_CANVAS_SIZES } from "@/lib/templates/negative-review-alert/dimensions";
import { SAMPLE_SIBUYA_FULL } from "@/lib/templates/negative-review-alert/sample-data";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import {
  AlertNotReadyError,
  MAX_ALERT_IMAGE_BYTES,
  assertAlertDataComplete,
  assertValidAlertPng,
  hasRealText,
  isAnalysisComplete,
  missingAlertFields,
  missingAnalysisFields,
  waitForCompleteAnalysis,
} from "./alert-readiness";

const COMPLETE: AnalisisIaRow = {
  review_id: "r1",
  resumen: "El cliente se queja de una espera prolongada.",
  motivo: "Atención al cliente",
  impacto: "Experiencia muy negativa; el cliente afirma que no volverá.",
  recomendacion: "Revisar tiempos de atención.",
  riesgo: "Alto",
  empleado_mencionado: null,
  sentimiento: "Negativo",
  created_at: "2026-10-26T14:50:00Z",
};

describe("completitud del análisis IA", () => {
  it("sin fila, o con campos vacíos / 'Sin análisis IA', NO está completo", () => {
    expect(isAnalysisComplete(null)).toBe(false);
    expect(missingAnalysisFields(null)).toEqual(["resumen", "impacto", "recomendacion", "sentimiento"]);
    expect(missingAnalysisFields({ ...COMPLETE, resumen: "  ", sentimiento: "Sin análisis IA" })).toEqual(["resumen", "sentimiento"]);
    expect(isAnalysisComplete(COMPLETE)).toBe(true);
  });

  it("hasRealText descarta marcadores de 'sin datos'", () => {
    for (const empty of [null, undefined, "", "  ", "N/A", "null", "Sin análisis IA", "Sin datos"]) expect(hasRealText(empty)).toBe(false);
    expect(hasRealText("Negativo")).toBe(true);
  });
});

describe("waitForCompleteAnalysis (condición de carrera con Make)", () => {
  const clock = () => {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  };

  it("espera a que el análisis aparezca y lo devuelve completo", async () => {
    const { now, sleep } = clock();
    const answers: (AnalisisIaRow | null)[] = [null, { ...COMPLETE, resumen: null }, COMPLETE];
    let calls = 0;
    const result = await waitForCompleteAnalysis(async () => answers[Math.min(calls++, answers.length - 1)] ?? null, { timeoutMs: 20_000, intervalMs: 2_500, now, sleep });
    expect(result).toBe(COMPLETE);
    expect(calls).toBe(3);
  });

  it("si no llega a tiempo lanza analysis_pending (no inventa nada) y lista lo que falta", async () => {
    const { now, sleep } = clock();
    let calls = 0;
    const promise = waitForCompleteAnalysis(async () => (calls++, null), { timeoutMs: 10_000, intervalMs: 2_500, now, sleep });
    await expect(promise).rejects.toMatchObject({ name: "AlertNotReadyError", code: "analysis_pending", fields: ["resumen", "impacto", "recomendacion", "sentimiento"] });
    expect(calls).toBeGreaterThan(1);
    expect(calls).toBeLessThanOrEqual(5);
  });

  it("un error de consulta se propaga: no se confunde con 'todavía no existe'", async () => {
    const { now, sleep } = clock();
    await expect(
      waitForCompleteAnalysis(async () => Promise.reject(new Error("db down")), { timeoutMs: 5_000, intervalMs: 1_000, now, sleep })
    ).rejects.toThrow("db down");
  });
});

describe("datos obligatorios de la alerta", () => {
  it("la alerta completa (con análisis) pasa", () => {
    expect(missingAlertFields(SAMPLE_SIBUYA_FULL)).toEqual([]);
    expect(() => assertAlertDataComplete(SAMPLE_SIBUYA_FULL)).not.toThrow();
  });

  it("reproduce la alerta rota: sin resumen/recomendación y sentimiento 'Sin análisis IA' se rechaza", () => {
    const broken = {
      ...SAMPLE_SIBUYA_FULL,
      ai_summary: null,
      recommendation: "Sin análisis IA",
      sentiment: "Sin análisis IA",
      detected_impact: "4.40 → 4.37",
      main_motive: "Atención al cliente",
    };
    expect(missingAlertFields(broken)).toEqual(["ai_summary", "recommendation", "sentiment"]);
    expect(() => assertAlertDataComplete(broken)).toThrow(AlertNotReadyError);
  });

  it("una reseña solo con estrellas puede ir sin análisis, pero nunca sin autor, marca o medias", () => {
    const starsOnly = { ...SAMPLE_SIBUYA_FULL, ai_summary: null, recommendation: "Sin análisis IA", sentiment: "Sin análisis IA", detected_impact: "Sin análisis IA", main_motive: "Sin análisis IA" };
    expect(() => assertAlertDataComplete(starsOnly, { requireAnalysis: false })).not.toThrow();
    expect(missingAlertFields({ ...starsOnly, brand: undefined, previous_rating: Number.NaN, review_author: "" }, { requireAnalysis: false })).toEqual([
      "review_author",
      "previous_rating",
      "brand",
    ]);
  });
});

describe("tamaño y formato del PNG", () => {
  const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#fff" } }).png().toBuffer();

  it("el tamaño de entrega conserva la proporción del diseño (sin deformar el texto)", () => {
    for (const ratio of ["4:3", "9:16"] as const) {
      const design = DESIGN_CANVAS_SIZES[ratio];
      const delivery = ALERT_CANVAS_SIZES[ratio];
      expect(delivery.width / delivery.height).toBeCloseTo(design.width / design.height, 3);
    }
  });

  it("acepta un PNG del tamaño de entrega y rechaza lo demás", async () => {
    const ok = ALERT_CANVAS_SIZES["4:3"];
    const nine = ALERT_CANVAS_SIZES["9:16"];
    const okPng = new Uint8Array(await png(ok.width, ok.height));
    const ninePng = new Uint8Array(await png(nine.width, nine.height));
    const oldPng = new Uint8Array(await png(1402, 1122));
    const jpeg = new Uint8Array(await sharp({ create: { width: ok.width, height: ok.height, channels: 3, background: "#fff" } }).jpeg().toBuffer());

    expect(() => assertValidAlertPng(okPng, "4:3")).not.toThrow();
    expect(() => assertValidAlertPng(ninePng, "9:16")).not.toThrow();
    expect(() => assertValidAlertPng(oldPng, "4:3")).toThrow(AlertNotReadyError);
    expect(() => assertValidAlertPng(new Uint8Array([1, 2, 3, 4]), "4:3")).toThrow(AlertNotReadyError);
    expect(() => assertValidAlertPng(jpeg, "4:3")).toThrow(AlertNotReadyError);
    expect(MAX_ALERT_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });
});
