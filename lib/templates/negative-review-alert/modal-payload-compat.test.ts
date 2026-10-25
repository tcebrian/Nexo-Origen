import { describe, expect, it } from "vitest";
import { brands } from "@/app/dashboard/restaurantes/data";
import type { Review } from "@/lib/reviews/types";
import { mapReviewToAlertData } from "./map-from-review";
import { validateAlertPayload } from "./validate-payload";

/**
 * Compatibilidad: lo que REALMENTE envía el modal de reseñas (`mapReviewToAlertData` → JSON) debe pasar la
 * validación estricta de SEC-006 para todas las marcas, notas y casos habituales (sin texto, sin análisis IA...).
 */
function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "1",
    reviewId: "r1",
    resenaId: "1",
    author: "Laura Martínez",
    initials: "LM",
    rating: 1,
    restaurant: "BK Utebo",
    restaurantSlug: "bk-utebo",
    brand: "bk",
    brandLabel: "Burger King",
    text: "La comida llegó fría.",
    date: new Date("2025-05-24T11:35:00"),
    activityDate: new Date("2025-05-24T11:35:00"),
    editada: false,
    location: "Av. Zaragoza, s/n, 50180 Utebo, Zaragoza",
    source: "google",
    sentiment: "negativa",
    category: "otros",
    priority: "Alta",
    estimatedImpact: "—",
    mediaBefore: 4.41,
    mediaAfter: 4.18,
    mediaImpact: -0.23,
    sentimentLabel: "Negativo",
    motiveLabel: "Tiempo de espera",
    riskLevel: "ALTO",
    impactLabel: "Bajada de 0.23 puntos en la media del local.",
    employeeMentioned: null,
    iaPending: false,
    recommendedAction: "Reforzar personal en hora punta.",
    reviewed: false,
    analyzed: true,
    ...overrides,
  } as Review;
}

/** Igual que el navegador: pasa por JSON (undefined desaparece, NaN pasa a null). */
const sent = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("el payload del modal pasa la validación estricta", () => {
  it.each(brands.map((b) => b.id))("marca %s", (brand) => {
    const result = validateAlertPayload(sent(mapReviewToAlertData(review({ brand }))));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it.each([1, 2, 3, 4, 5])("reseña de %s estrellas", (rating) => {
    expect(validateAlertPayload(sent(mapReviewToAlertData(review({ rating })))).ok).toBe(true);
  });

  it("reseña sin texto, sin análisis IA ni medias", () => {
    const data = mapReviewToAlertData(
      review({ text: "", iaPending: true, mediaBefore: null, mediaAfter: null, mediaImpact: null, location: undefined, motiveLabel: "" })
    );
    const result = validateAlertPayload(sent(data));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("reseña con la longitud máxima de Google (4096) y fecha inválida", () => {
    const data = mapReviewToAlertData(review({ text: "ñ".repeat(4096), date: new Date("no") }));
    const result = validateAlertPayload(sent(data));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
