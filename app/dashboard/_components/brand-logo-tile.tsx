import {
  LOGO_FRAME,
  type BrandVisual,
  type BrandLogoSize,
} from "@/lib/restaurants/brand-visuals";
import { BrandLogoImage } from "./brand-logo-image";

const monogramSize: Record<BrandLogoSize, string> = {
  chip: "text-[8px]",
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-[12px]",
  rail: "text-[11px]",
};

const innerRadius: Record<BrandLogoSize, number> = {
  chip: 4,
  xs: 5,
  sm: 6,
  md: 7,
  lg: 8,
  rail: 7,
};

type BrandLogoTileProps = {
  visual: BrandVisual;
  size?: BrandLogoSize;
  alt?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Marco unificado: borde de marca + lienzo blanco + logo centrado con fit real.
 */
export function BrandLogoTile({
  visual,
  size = "md",
  alt,
  className = "",
  priority = false,
}: BrandLogoTileProps) {
  const frame = LOGO_FRAME[size];
  const label = alt ?? visual.monogram;

  return (
    <div
      className={`flex shrink-0 items-center justify-center border shadow-[var(--nexo-shadow-sm)] ${frame.radius} ${className}`}
      style={{
        width: frame.width,
        height: frame.height,
        padding: frame.padding,
        backgroundColor: visual.tileBg,
        borderColor: visual.tileBorder,
      }}
      title={label}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden bg-white"
        style={{
          borderRadius: innerRadius[size],
          boxShadow: "inset 0 0 0 1px rgba(26,26,26,0.05)",
        }}
      >
        {visual.logo ? (
          <BrandLogoImage visual={visual} size={size} alt={label} priority={priority} />
        ) : (
          <span
            className={`font-bold tracking-tight ${monogramSize[size]}`}
            style={{ color: visual.accent }}
          >
            {visual.monogram}
          </span>
        )}
      </div>
    </div>
  );
}
