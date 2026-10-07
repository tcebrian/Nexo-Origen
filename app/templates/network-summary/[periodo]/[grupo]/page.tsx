import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isReportPeriodSlug, resolveReportPeriodRange, type ReportPeriodSlug } from "@/lib/reports/period-ranges";
import { isNetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { INTERNAL_RENDER_HEADER, canRenderNetworkTemplate } from "@/lib/reports/network-summary/render-access";
import { fetchNetworkSummaryReport } from "@/lib/reports/network-summary/fetch";
import { NETWORK_SUMMARY_GROUP_VISUALS } from "@/lib/reports/network-summary/group-visuals";
import { NetworkSummaryStandardTemplate } from "@/templates/network-summary/network-summary-standard-template";
import { NetworkSummaryBkTemplate } from "@/templates/network-summary/network-summary-bk-template";
import { NetworkSummaryPpTemplate } from "@/templates/network-summary/network-summary-pp-template";
import { NetworkSummarySgTemplate } from "@/templates/network-summary/network-summary-sg-template";
import { NetworkSummaryThTemplate } from "@/templates/network-summary/network-summary-th-template";
import { NetworkSummaryHbTemplate } from "@/templates/network-summary/network-summary-hb-template";
import type { NetworkSummaryData } from "@/lib/reports/network-summary/types";

export const dynamic = "force-dynamic";

const DATA_LOAD_ERROR = "No se han podido cargar los datos del periodo seleccionado.";

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
  // Plantilla interna de renderizado: solo super_admin con sesión o el Chromium de
  // Nexo con la credencial interna. Cualquier otro acceso es un 404.
  const requestHeaders = await headers();
  if (!(await canRenderNetworkTemplate(requestHeaders.get(INTERNAL_RENDER_HEADER)))) notFound();

  const { periodo, grupo } = await params;
  const { base, offset } = await searchParams;

  if (!isReportPeriodSlug(periodo) || !isNetworkReportGroupId(grupo)) notFound();

  const offsetNumber = offset ? Number.parseInt(offset, 10) : 0;
  const range = resolveReportPeriodRange(periodo, Number.isFinite(offsetNumber) ? offsetNumber : 0);
  let data: NetworkSummaryData;
  try {
    data = await fetchNetworkSummaryReport(grupo, range);
  } catch (error) {
    // Grupo Hámbar nunca se pinta con datos de relleno: si Supabase falla, la
    // captura recibe este mensaje y aborta con él (ver capture-image.ts).
    if (grupo === "hambar") {
      console.error("[network-summary/hambar] No se pudieron cargar los datos:", error);
      return <div className="nws-error">{DATA_LOAD_ERROR}</div>;
    }
    throw error;
  }
  const visual = NETWORK_SUMMARY_GROUP_VISUALS[grupo];

  if (grupo === "bk") {
    return (
      <NetworkSummaryBkTemplate
        data={data}
        visual={visual}
        periodoAdjective={PERIODO_ADJECTIVE[periodo]}
        assetBaseUrl={base}
      />
    );
  }

  if (grupo === "pp") {
    return (
      <NetworkSummaryPpTemplate
        data={data}
        visual={visual}
        periodoAdjective={PERIODO_ADJECTIVE[periodo]}
        assetBaseUrl={base}
      />
    );
  }

  if (grupo === "sg-es" || grupo === "sg-ad") {
    return (
      <NetworkSummarySgTemplate
        data={data}
        visual={visual}
        periodoAdjective={PERIODO_ADJECTIVE[periodo]}
        assetBaseUrl={base}
      />
    );
  }

  if (grupo === "th") {
    return (
      <NetworkSummaryThTemplate
        data={data}
        visual={visual}
        periodoAdjective={PERIODO_ADJECTIVE[periodo]}
        assetBaseUrl={base}
      />
    );
  }

  if (grupo === "hambar") {
    return (
      <NetworkSummaryHbTemplate
        data={data}
        visual={visual}
        periodoAdjective={PERIODO_ADJECTIVE[periodo]}
        assetBaseUrl={base}
      />
    );
  }

  return (
    <NetworkSummaryStandardTemplate
      data={data}
      visual={visual}
      periodoAdjective={PERIODO_ADJECTIVE[periodo]}
      assetBaseUrl={base}
    />
  );
}
