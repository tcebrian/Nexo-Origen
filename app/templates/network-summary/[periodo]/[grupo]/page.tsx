import { notFound } from "next/navigation";
import { isReportPeriodSlug, resolveReportPeriodRange, type ReportPeriodSlug } from "@/lib/reports/period-ranges";
import { isNetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { fetchNetworkSummaryReport } from "@/lib/reports/network-summary/fetch";
import { NETWORK_SUMMARY_GROUP_VISUALS } from "@/lib/reports/network-summary/group-visuals";
import { NetworkSummaryStandardTemplate } from "@/templates/network-summary/network-summary-standard-template";

export const dynamic = "force-dynamic";

const PERIODO_ADJECTIVE: Record<ReportPeriodSlug, string> = {
  semanal: "semanal",
  mensual: "mensual",
  trimestral: "trimestral",
};

type PageProps = {
  params: Promise<{ periodo: string; grupo: string }>;
  searchParams: Promise<{ base?: string; offset?: string }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { periodo, grupo } = await params;
  const { base, offset } = await searchParams;

  if (!isReportPeriodSlug(periodo) || !isNetworkReportGroupId(grupo)) notFound();

  const offsetNumber = offset ? Number.parseInt(offset, 10) : 0;
  const range = resolveReportPeriodRange(periodo, Number.isFinite(offsetNumber) ? offsetNumber : 0);
  const data = await fetchNetworkSummaryReport(grupo, { start: range.start, end: range.end });
  const visual = NETWORK_SUMMARY_GROUP_VISUALS[grupo];

  return (
    <NetworkSummaryStandardTemplate
      data={data}
      visual={visual}
      periodoAdjective={PERIODO_ADJECTIVE[periodo]}
      assetBaseUrl={base}
    />
  );
}
