import type { ReactNode } from "react";
import { textKicker, textSubtitle, textTitle } from "./ranking-styles";

export function SectionLabel({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-px bg-white/20" />
          <p className={textKicker}>{kicker}</p>
        </div>
        <h2 className={`mt-1.5 ${textTitle}`}>{title}</h2>
        {description && <p className={`mt-1 max-w-lg text-sm leading-relaxed text-gray-500`}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
