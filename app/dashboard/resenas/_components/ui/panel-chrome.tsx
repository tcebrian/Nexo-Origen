import type { ReactNode } from "react";
import { panelChrome, sectionPad, textKicker, textSubtitle, textTitle } from "./resenas-styles";

export function PanelChrome({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${panelChrome} ${sectionPad} py-3.5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-px bg-white/25" />
            <p className={textKicker}>{kicker}</p>
          </div>
          {title && <p className={`mt-2 ${textTitle}`}>{title}</p>}
          {description && <p className={`mt-1 ${textSubtitle}`}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
