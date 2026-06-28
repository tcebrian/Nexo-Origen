import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { mapReportRowToAlertData } from "@/lib/templates/negative-review-alert/map-from-report-row";
import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import type { NegativeReviewReportRow } from "../types";

export type NegativeReviewTemplateProps = {
  data: NegativeReviewReportRow;
  assetBaseUrl?: string;
};

/** Plantilla premium ejecutiva para alertas de reseñas negativas. */
export function getNegativeReviewTemplate(_brand: BrandId) {
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

export const SUPPORTED_NEGATIVE_REVIEW_BRANDS: BrandId[] = ["bk", "pp", "sg", "th", "ribs", "sibuya", "tv"];

export { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
export { mapReportRowToAlertData } from "@/lib/templates/negative-review-alert/map-from-report-row";
export { mapRowToTemplateData } from "./map-template-data";
export type { NegativeReviewTemplateData, TemplateListItem } from "./template-data";
