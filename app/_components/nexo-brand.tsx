import Image from "next/image";
import type { ReactNode } from "react";

export const NEXO_ORIGEN_LOGO_SRC = "/nexo-origen-logo.png";
export const NEXO_ORIGEN_ICON_SRC = "/nexo-origen-icon.png";
export const NEXO_ORIGEN_WORDMARK_TEXT_SRC = "/nexo-origen-wordmark-text.png";
/** Assets del informe PNG (fondo transparente, generados desde el logo oficial). */
export const NEXO_ORIGEN_REPORT_ICON_SRC = "/nexo-origen-report-icon.png";
export const NEXO_ORIGEN_REPORT_WORDMARK_SRC = "/nexo-origen-report-wordmark.png";

export const NEXO_ORIGIN_LOGO_ASPECT = 723 / 541;
export const NEXO_ORIGIN_ICON_ASPECT = 406 / 413;
export const NEXO_ORIGIN_WORDMARK_TEXT_ASPECT = 715 / 62;

type NexoOrigenWordmarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSubtitle?: boolean;
  subtitle?: string;
  align?: "left" | "center";
  subtitleClassName?: string;
  /** Dashboard: icono más pequeño, texto independiente */
  variant?: "full" | "dashboard";
};

const sizes = {
  sm: { textWidth: 90, iconWidth: 71 },
  md: { textWidth: 78, iconWidth: 62 },
  lg: { textWidth: 140, iconWidth: 140 },
  xl: { textWidth: 240, iconWidth: 176 },
};

function NexoBrandIconGlow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[55%] h-[78%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.34)_0%,rgba(124,58,237,0.14)_42%,transparent_72%)] blur-lg"
      />
      {children}
    </div>
  );
}

function NexoFullLogoImage({
  width,
  priority = false,
  className = "",
}: {
  width: number;
  priority?: boolean;
  className?: string;
}) {
  const height = Math.round(width / NEXO_ORIGIN_LOGO_ASPECT);

  return (
    <NexoBrandIconGlow>
      <Image
        src={NEXO_ORIGEN_LOGO_SRC}
        alt="Nexo Origen"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className={`relative z-[1] block max-w-full object-contain [filter:drop-shadow(0_2px_6px_rgba(0,0,0,0.28))_drop-shadow(0_10px_24px_rgba(124,58,237,0.22))] ${className}`}
        style={{ width, height }}
      />
    </NexoBrandIconGlow>
  );
}

function NexoDashboardBrand({
  textWidth,
  iconWidth,
  compact = false,
  priority = false,
}: {
  textWidth: number;
  iconWidth: number;
  compact?: boolean;
  priority?: boolean;
}) {
  const iconHeight = Math.round(iconWidth / NEXO_ORIGIN_ICON_ASPECT);
  const textHeight = Math.round(textWidth / NEXO_ORIGIN_WORDMARK_TEXT_ASPECT);

  return (
    <div
      className={`flex w-full flex-col items-center ${compact ? "max-w-[100px]" : "max-w-[320px]"}`}
    >
      <NexoBrandIconGlow className="mb-0.5">
        <Image
          src={NEXO_ORIGEN_ICON_SRC}
          alt=""
          aria-hidden
          width={iconWidth}
          height={iconHeight}
          priority={priority}
          unoptimized
          className="relative z-[1] block object-contain [filter:drop-shadow(0_2px_5px_rgba(0,0,0,0.32))_drop-shadow(0_8px_18px_rgba(124,58,237,0.24))]"
          style={{ width: iconWidth, height: iconHeight }}
        />
      </NexoBrandIconGlow>
      <Image
        src={NEXO_ORIGEN_WORDMARK_TEXT_SRC}
        alt="Nexo Origen"
        width={textWidth}
        height={textHeight}
        priority={priority}
        unoptimized
        className="-mt-1 block object-contain [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.55))_drop-shadow(0_4px_10px_rgba(0,0,0,0.22))]"
        style={{ width: textWidth, height: textHeight }}
      />
    </div>
  );
}

export function NexoLogo({
  width = 90,
  className = "",
  priority = false,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return <NexoFullLogoImage width={width} priority={priority} className={className} />;
}

export function NexoOrigenWordmark({
  size = "sm",
  className = "",
  showSubtitle = false,
  subtitle = "Reputation Intelligence",
  align = "left",
  subtitleClassName = "text-[var(--nexo-text-tertiary)]",
  variant = "full",
}: NexoOrigenWordmarkProps) {
  const s = sizes[size];
  const centered = align === "center";

  if (variant === "dashboard") {
    return (
      <div className={`${centered ? "flex justify-center" : ""} ${className}`}>
        <NexoDashboardBrand
          textWidth={s.textWidth}
          iconWidth={s.iconWidth}
          compact={size === "sm" || size === "md"}
          priority={size === "xl"}
        />
        {showSubtitle ? (
          <p
            className={`font-sans mt-2 font-medium uppercase tracking-[0.18em] text-[10px] ${subtitleClassName}`}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${centered ? "flex justify-center" : ""} ${className}`}>
      <NexoFullLogoImage width={s.textWidth} priority={size === "lg"} />
      {showSubtitle ? (
        <p
          className={`font-sans mt-3 font-medium uppercase tracking-[0.18em] text-[10px] ${subtitleClassName}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
