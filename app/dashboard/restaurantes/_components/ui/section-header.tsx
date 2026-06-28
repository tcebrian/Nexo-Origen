import type { ReactNode } from "react";
import { textKicker, textSectionTitle } from "./restaurantes-styles";

export function SectionHeader({
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
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
      <div>
        <p className={textKicker}>{kicker}</p>
        <h2 className={`mt-1.5 ${textSectionTitle}`}>{title}</h2>
        {description && <p className="mt-1.5 text-[13px] text-gray-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}
