import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { mapReportRowToAlertData } from "@/lib/templates/negative-review-alert/map-from-report-row";
import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";
import type { NegativeReviewReportRow } from "../types";

export type NegativeReviewTemplateProps = {
  data: NegativeReviewReportRow;
  assetBaseUrl?: string;
};

/**
 * Plantilla visual para alertas de reseñas negativas. Cada marca puede tener su
 * propio diseño (identidad de la marca, no del sistema Nexo) — de momento solo
 * Burger King; el resto sigue usando la plantilla genérica hasta que se diseñe la suya.
 */
export function getNegativeReviewTemplate(brand: BrandId) {
  if (brand === "bk") return BurgerKingAlertTemplate;
  return NegativeReviewAlertTemplate;
}

export function isNegativeReviewTemplateSupported(_brand: BrandId) {
  return true;
}

export function mapReportRowToAlertTemplateProps(
  row: NegativeReviewReportRow,
  assetBaseUrl?: string
) {
  return {
    data: mapReportRowToAlertData(row),
    assetBaseUrl,
  };
}

export const SUPPORTED_NEGATIVE_REVIEW_BRANDS: BrandId[] = ["bk", "pp", "sg", "th", "ribs", "sibuya", "tv", "vault"];

export { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
export { mapReportRowToAlertData } from "@/lib/templates/negative-review-alert/map-from-report-row";
export { mapRowToTemplateData } from "./map-template-data";
export type { NegativeReviewTemplateData, TemplateListItem } from "./template-data";
