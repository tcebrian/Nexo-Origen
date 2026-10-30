import { describe, expect, it } from "vitest";
import { mapReportRowToAlertData } from "./map-from-report-row";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";

const row = (over: Partial<NegativeReviewReportRow>): NegativeReviewReportRow => ({
  id: "r1", restauranteId: 3, restaurant: "BK Illa Carlemany", restaurantSlug: "bk-illa-carlemany", brand: "bk", brandLabel: "Burger King",
  city: "Escaldes", address: "—", author: "Ana", dateIso: "2026-10-26T14:47:00.000Z", dateLabel: "26 de octubre de 2026", stars: 1,
  comment: "Mal", motive: "Otros", detectedReasons: [], sentiment: "Negativo", riskLevel: "Alto", aiSummary: "x", analisisPending: false,
  mediaBefore: 4, mediaAfter: 3.9, impact: -0.1, impactText: "x", recommendation: "x", employeeMentioned: null, reviewCountAfter: 2,
  totalReviews: null, lifetimeMedia: null, ...over,
});

describe("título del local en la alerta", () => {
  it("Burger King usa el nombre del restaurante, no la ciudad del catálogo (BK Illa Carlemany ≠ Escaldes)", () => {
    expect(mapReportRowToAlertData(row({})).restaurant_name).toBe("BK ILLA CARLEMANY");
    expect(mapReportRowToAlertData(row({ restaurant: "Burger King Utebo", city: "Zaragoza" })).restaurant_name).toBe("BK UTEBO");
    expect(mapReportRowToAlertData(row({ restaurant: "BK Calatayud", city: "Zaragoza" })).restaurant_name).toBe("BK CALATAYUD");
  });

  it("otras marcas conservan el nombre completo", () => {
    expect(mapReportRowToAlertData(row({ brand: "th", restaurant: "Tim Hortons Escaldes" })).restaurant_name).toBe("TIM HORTONS ESCALDES");
  });
});
