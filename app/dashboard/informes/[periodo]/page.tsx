import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isReportPeriodSlug, REPORT_PERIOD_LABELS, resolveReportPeriodRange } from "@/lib/reports/period-ranges";
import { InformesPeriodoBrands } from "../_components/informes-periodo-brands";

type PageProps = {
  params: Promise<{ periodo: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { periodo } = await params;
  if (!isReportPeriodSlug(periodo)) return { title: "Informes | Nexo Origen" };
  return { title: `${REPORT_PERIOD_LABELS[periodo]} | Nexo Origen` };
}

export default async function Page({ params }: PageProps) {
  const { periodo } = await params;
  if (!isReportPeriodSlug(periodo)) notFound();

  const range = resolveReportPeriodRange(periodo);

  return <InformesPeriodoBrands periodo={periodo} rangeLabel={range.label} />;
}
