import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isReportPeriodSlug, REPORT_PERIOD_LABELS, resolveReportPeriodRange } from "@/lib/reports/period-ranges";
import { InformesPeriodoBrands } from "../_components/informes-periodo-brands";

type PageProps = {
  params: Promise<{ periodo: string }>;
  searchParams: Promise<{ offset?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { periodo } = await params;
  if (!isReportPeriodSlug(periodo)) return { title: "Informes | Nexo Origen" };
  return { title: `${REPORT_PERIOD_LABELS[periodo]} | Nexo Origen` };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { periodo } = await params;
  const { offset: offsetParam } = await searchParams;
  if (!isReportPeriodSlug(periodo)) notFound();

  const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  const range = resolveReportPeriodRange(periodo, offset);

  return <InformesPeriodoBrands periodo={periodo} offset={offset} rangeLabel={range.label} />;
}
