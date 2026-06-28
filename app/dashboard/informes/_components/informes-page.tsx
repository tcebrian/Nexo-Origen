"use client";

import { useMemo } from "react";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "../../_components/date-range-context";
import { InformesAutomaticos } from "./informes-automaticos";
import { InformesHeader } from "./informes-header";
import { InformesNegativeReviews } from "./informes-negative-reviews";

export function InformesPage() {
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);

  return (
    <div className="relative flex min-h-0 flex-col gap-6 pb-10">
      <InformesHeader periodLabel={periodLabel} />

      <InformesAutomaticos />

      <InformesNegativeReviews
        start={range.start}
        end={range.end}
        periodLabel={periodLabel}
      />
    </div>
  );
}
