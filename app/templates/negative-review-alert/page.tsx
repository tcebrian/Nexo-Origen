import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
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

  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#e8e4dd",
        padding: 24,
      }}
    >
      <NegativeReviewAlertTemplate data={data} />
    </main>
  );
}
