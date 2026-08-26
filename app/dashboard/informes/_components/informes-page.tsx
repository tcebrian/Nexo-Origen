"use client";

import { formatDateRangeLabel, useDateRange } from "../../_components/date-range-context";
import { InformesHeader } from "./informes-header";
import { InformesPeriodButtons } from "./informes-period-buttons";

export function InformesPage() {
  const { range: activeRange } = useDateRange();
  const periodLabel = formatDateRangeLabel(activeRange);

  return (
    <div className="relative flex min-h-0 flex-col gap-6 pb-10">
      <InformesHeader periodLabel={periodLabel} />

      <InformesPeriodButtons />
    </div>
  );
}
