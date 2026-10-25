import { describe, expect, it } from "vitest";
import { SAMPLE_NEGATIVE_REVIEW_ALERT } from "./sample-data";
import { ALERT_LIMITS, validateAlertPayload } from "./validate-payload";

const valid = () => ({ ...SAMPLE_NEGATIVE_REVIEW_ALERT }) as Record<string, unknown>;
const fieldOf = (input: unknown) => {
  const result = validateAlertPayload(input);
  return result.ok ? null : result.field;
};

describe("validateAlertPayload", () => {
  it("acepta un payload completo (el que envían el modal y /preview)", () => {
    expect(validateAlertPayload(valid()).ok).toBe(true);
  });

  it("acepta campos opcionales nulos, como los envía el modal", () => {
    const result = validateAlertPayload({
      ...valid(),
      ai_summary: null,
      main_motive: null,
      detected_impact: null,
      employee_mentioned: null,
      review_count: null,
      lifetime_rating: null,
      weekly_reviews_before: null,
    });
    expect(result.ok).toBe(true);
  });

  it("acepta una reseña sin texto y de 5 estrellas (el modal muestra cualquier nota)", () => {
    expect(validateAlertPayload({ ...valid(), review_comment: "", review_stars: 5 }).ok).toBe(true);
  });

  it.each(["restaurant_name", "review_author", "review_comment", "review_stars", "brand_logo_url", "detected_reasons", "nexo_logo_url"])(
    "rechaza si falta %s (no se completa con datos de ejemplo)",
    (key) => {
      const input = valid();
      delete input[key];
      expect(fieldOf(input)).toBe(key);
    }
  );

  it("rechaza lo que no es un objeto", () => {
    for (const input of [null, undefined, "x", 3, [], [valid()]]) expect(fieldOf(input)).toBe("body");
  });

  it.each([0, 6, -1, 2.5, "3", NaN, null])("rechaza estrellas fuera de rango o no enteras (%s)", (stars) => {
    expect(fieldOf({ ...valid(), review_stars: stars })).toBe("review_stars");
  });

  it("rechaza textos excesivamente grandes", () => {
    expect(fieldOf({ ...valid(), review_comment: "a".repeat(ALERT_LIMITS.comment + 1) })).toBe("review_comment");
    expect(fieldOf({ ...valid(), restaurant_name: "a".repeat(ALERT_LIMITS.short + 1) })).toBe("restaurant_name");
    expect(fieldOf({ ...valid(), review_author: "a".repeat(ALERT_LIMITS.short + 1) })).toBe("review_author");
    expect(fieldOf({ ...valid(), ai_summary: "a".repeat(ALERT_LIMITS.long + 1) })).toBe("ai_summary");
    expect(fieldOf({ ...valid(), review_date: "a".repeat(61) })).toBe("review_date");
  });

  it("acepta el límite exacto del comentario", () => {
    expect(validateAlertPayload({ ...valid(), review_comment: "a".repeat(ALERT_LIMITS.comment) }).ok).toBe(true);
  });

  it("limita las listas", () => {
    expect(fieldOf({ ...valid(), detected_reasons: Array(ALERT_LIMITS.reasons + 1).fill("x") })).toBe("detected_reasons");
    expect(fieldOf({ ...valid(), detected_reasons: ["a".repeat(ALERT_LIMITS.short + 1)] })).toBe("detected_reasons");
    expect(fieldOf({ ...valid(), detected_reasons: [1] })).toBe("detected_reasons");
  });

  it("rechaza tipos incorrectos y números fuera de rango", () => {
    expect(fieldOf({ ...valid(), restaurant_name: 5 })).toBe("restaurant_name");
    expect(fieldOf({ ...valid(), current_rating: 9 })).toBe("current_rating");
    expect(fieldOf({ ...valid(), rating_impact: Infinity })).toBe("rating_impact");
    expect(fieldOf({ ...valid(), aspect_ratio: "16:9" })).toBe("aspect_ratio");
  });

  it("solo admite URLs de imagen propias o data:image (nunca un host externo)", () => {
    expect(validateAlertPayload({ ...valid(), brand_logo_url: "/brands/vault.svg" }).ok).toBe(true);
    for (const bad of ["https://evil.example/x.png", "//evil.example/x.png", "http://169.254.169.254/", "javascript:alert(1)", "/a\\b"]) {
      expect(fieldOf({ ...valid(), brand_logo_url: bad })).toBe("brand_logo_url");
      expect(fieldOf({ ...valid(), nexo_logo_url: bad })).toBe("nexo_logo_url");
    }
  });

  it("descarta campos desconocidos y no admite risk_level del cliente", () => {
    const result = validateAlertPayload({ ...valid(), review_stars: 1, risk_level: "BAJO", evil: "x" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty("evil");
    expect(result.data.risk_level).toBe("ALTO");
  });

  it("rechaza objetos con demasiadas claves", () => {
    const big: Record<string, unknown> = valid();
    for (let i = 0; i < ALERT_LIMITS.maxKeys; i++) big[`k${i}`] = 1;
    expect(fieldOf(big)).toBe("body");
  });
});
