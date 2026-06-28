"use client";

import { glass } from "./styles";
import { AnimatedNumber } from "./motion/animated-number";

export type KpiIconType = "star" | "chat" | "warning" | "store";

function KpiIcon({ type }: { type: KpiIconType }) {
  const className = "h-5 w-5 text-violet-300";

  if (type === "star") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.09 6.26L20.5 9.27l-5 3.64L16.82 20 12 16.77 7.18 20l1.32-7.09-5-3.64 6.41-.99L12 2z" />
      </svg>
    );
  }

  if (type === "chat") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    );
  }

  if (type === "warning") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function KpiCard({
  title,
  value,
  change,
  icon,
  positive,
  animateValue,
  decimals = 0,
}: {
  title: string;
  value: string;
  change: string;
  icon: KpiIconType;
  positive: boolean | null;
  animateValue?: number;
  decimals?: number;
}) {
  return (
    <div className={`p-5 ${glass}`}>
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
          <KpiIcon type={icon} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{title}</p>
        {animateValue !== undefined ? (
          <AnimatedNumber
            value={animateValue}
            decimals={decimals}
            className="mt-2 block font-mono text-3xl font-light tabular-nums text-white"
          />
        ) : (
          <p className="mt-2 font-mono text-3xl font-light tabular-nums text-white">{value}</p>
        )}
        <p
          className={`mt-2 text-xs ${
            positive === true
              ? "text-emerald-400"
              : positive === false
                ? "text-red-400"
                : "text-gray-500"
          }`}
        >
          {change}
        </p>
      </div>
    </div>
  );
}
