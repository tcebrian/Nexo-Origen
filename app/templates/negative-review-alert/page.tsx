import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";
import { PopeyesAlertTemplate } from "@/templates/negative-review-alert/brands/popeyes-alert-template";
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

  const data = parseAlertFromSearchParams(urlParams, SAMPLE_NEGATIVE_REVIEW_ALERT);
  const AlertTemplate =
    data.brand === "bk"
      ? BurgerKingAlertTemplate
      : data.brand === "pp"
        ? PopeyesAlertTemplate
        : NegativeReviewAlertTemplate;
  const background = data.brand === "bk" || data.brand === "pp" ? "#f3ecdc" : "#e8e4dd";

  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        padding: 24,
      }}
    >
      <AlertTemplate data={data} />
    </main>
  );
}
