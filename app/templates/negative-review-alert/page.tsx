import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";
import { PopeyesAlertTemplate } from "@/templates/negative-review-alert/brands/popeyes-alert-template";
import { SantaGloriaAlertTemplate } from "@/templates/negative-review-alert/brands/santa-gloria-alert-template";
import { RibsAlertTemplate } from "@/templates/negative-review-alert/brands/ribs-alert-template";
import { TimHortonsAlertTemplate } from "@/templates/negative-review-alert/brands/tim-hortons-alert-template";
import { SibuyaAlertTemplate } from "@/templates/negative-review-alert/brands/sibuya-alert-template";
import { TabernaVolapieAlertTemplate } from "@/templates/negative-review-alert/brands/taberna-volapie-alert-template";
import { VaultAlertTemplate } from "@/templates/negative-review-alert/brands/vault-alert-template";
import { parseAlertFromSearchParams } from "@/lib/templates/negative-review-alert/parse-payload";
import { SAMPLE_NEGATIVE_REVIEW_ALERT } from "@/lib/templates/negative-review-alert/sample-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NegativeReviewAlertTemplatePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const urlParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      urlParams.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      urlParams.set(key, value[0]);
    }
  }

  // Con datos reales en la URL (los pone `buildAlertTemplateUrl`, que omite los valores nulos) un campo ausente
  // significa "no existe", no "usa el ejemplo": así ningún dato de muestra se cuela en una alerta real.
  const isRealPayload = urlParams.has("review_author");
  const fallback = isRealPayload
    ? {
        ...SAMPLE_NEGATIVE_REVIEW_ALERT,
        ai_summary: null,
        main_motive: null,
        detected_impact: null,
        employee_mentioned: null,
        period_label: null,
        review_count: null,
        lifetime_rating: null,
        weekly_period_label: null,
        weekly_reviews_before: null,
        weekly_reviews_after: null,
        weekly_media_before: null,
        weekly_media_after: null,
      }
    : SAMPLE_NEGATIVE_REVIEW_ALERT;
  const data = parseAlertFromSearchParams(urlParams, fallback);
  const AlertTemplate =
    data.brand === "bk"
      ? BurgerKingAlertTemplate
      : data.brand === "pp"
        ? PopeyesAlertTemplate
        : data.brand === "sg"
          ? SantaGloriaAlertTemplate
          : data.brand === "ribs"
            ? RibsAlertTemplate
            : data.brand === "th"
              ? TimHortonsAlertTemplate
              : data.brand === "sibuya"
                ? SibuyaAlertTemplate
                : data.brand === "tv"
                  ? TabernaVolapieAlertTemplate
                  : data.brand === "vault"
                    ? VaultAlertTemplate
                    : NegativeReviewAlertTemplate;
  const background =
    data.brand === "bk" ||
    data.brand === "pp" ||
    data.brand === "sg" ||
    data.brand === "ribs" ||
    data.brand === "th" ||
    data.brand === "sibuya" ||
    data.brand === "tv" ||
    data.brand === "vault"
      ? "#f3ecdc"
      : "#e8e4dd";

  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "safe center",
        background,
        padding: 24,
      }}
    >
      <AlertTemplate data={data} />
    </main>
  );
}
