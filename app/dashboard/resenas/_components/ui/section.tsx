"use client";

import type { ReactNode } from "react";

export function SectionHeader({
  step,
  title,
  description,
  action,
  accent = "violet",
}: {
  step?: number;
  title: string;
  description?: string;
  action?: ReactNode;
  accent?: "violet" | "rose";
}) {
  const stepRing =
    accent === "rose"
      ? "border-red-400/25 bg-gradient-to-br from-red-500/15 to-transparent text-red-200"
      : "border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-transparent text-violet-200";

  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5">
      <div className="flex gap-3.5">
        {step !== undefined && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-mono text-[11px] font-medium ${stepRing}`}
          >
            {step}
          </span>
        )}
        <div>
          <h2 className="text-[15px] font-medium tracking-tight text-white">{title}</h2>
          {description && (
            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-gray-500">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionDivider() {
  return (
    <div className="mx-6 border-t border-white/[0.06] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
  );
}
