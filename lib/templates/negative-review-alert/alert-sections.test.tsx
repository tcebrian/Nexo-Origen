import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_SIBUYA_FULL, SAMPLE_BK_FULL } from "./sample-data";
import { SibuyaAlertTemplate } from "@/templates/negative-review-alert/brands/sibuya-alert-template";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";

const SECTIONS = ["Resumen IA", "Motivo principal", "Impacto detectado", "Recomendación", "CONCLUSIÓN / ACCIÓN", "IMPACTO EN LA MEDIA", "DIAGNÓSTICO NEXO", "ANÁLISIS NEXO", "Sentimiento", "Riesgo"];

const render = (Template: typeof SibuyaAlertTemplate, data: typeof SAMPLE_SIBUYA_FULL) => renderToStaticMarkup(createElement(Template, { data }));

describe("las plantillas muestran todos los campos disponibles (comentario normal)", () => {
  const data = { ...SAMPLE_SIBUYA_FULL, review_comment: "Esperamos mucho y el postre estaba congelado. Mal servicio." };

  for (const [name, Template, sample] of [
    ["Sibuya", SibuyaAlertTemplate, data],
    ["Burger King", BurgerKingAlertTemplate, { ...SAMPLE_BK_FULL, review_comment: data.review_comment }],
  ] as const) {
    it(`${name}: resumen, motivo, impacto textual, recomendación, sentimiento, riesgo y conclusión`, () => {
      const html = render(Template as typeof SibuyaAlertTemplate, sample as typeof data);
      for (const section of SECTIONS) expect(html, `${name} sin «${section}»`).toContain(section);
      expect(html).toContain(sample.ai_summary as string);
      expect(html).toContain(sample.detected_impact as string);
      expect(html).toContain(sample.recommendation);
      expect(html).toContain("Negativo");
      expect(html).not.toContain("Sin datos");
    });
  }

  it("con un análisis incompleto las secciones desaparecen (por eso el envío exige el análisis completo)", () => {
    const html = render(SibuyaAlertTemplate, { ...data, ai_summary: null, recommendation: "Sin análisis IA", sentiment: "Sin análisis IA", detected_impact: null });
    expect(html).not.toContain("CONCLUSIÓN / ACCIÓN");
    expect(html).not.toContain("Resumen IA");
    expect(html).toContain("Sin datos");
  });
});
