import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { BrandLogoSize } from "@/lib/restaurants/brand-visuals";
import { BrandMark } from "./brand-mark";

type RestaurantBrandLineProps = {
  brand: BrandId;
  name: string;
  /** Si se indica, muestra «marca / restaurante» junto al logo. */
  brandLabel?: string;
  logoSize?: BrandLogoSize;
  layout?: "inline" | "stack";
  className?: string;
  nameClassName?: string;
  separatorClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
};

function BrandRestaurantName({
  brandLabel,
  restaurantName,
  className,
  separatorClassName = "text-[var(--nexo-text-tertiary)]",
}: {
  brandLabel?: string;
  restaurantName: string;
  className: string;
  separatorClassName?: string;
}) {
  const brand = brandLabel?.trim();
  const restaurant = restaurantName.trim();

  if (!brand || brand.localeCompare(restaurant, undefined, { sensitivity: "accent" }) === 0) {
    return <span className={className}>{restaurant}</span>;
  }

  return (
    <span className={className}>
      <span>{brand}</span>
      <span className={separatorClassName}> / </span>
      <span>{restaurant}</span>
    </span>
  );
}

export function RestaurantBrandLine({
  brand,
  name,
  brandLabel,
  logoSize = "xs",
  layout = "inline",
  className = "",
  nameClassName = "min-w-0 truncate text-sm font-medium text-gray-100",
  separatorClassName,
  subtitle,
  subtitleClassName = "mt-1 truncate text-[12px] text-gray-500",
}: RestaurantBrandLineProps) {
  const title = (
    <BrandRestaurantName
      brandLabel={brandLabel}
      restaurantName={name}
      className={nameClassName}
      separatorClassName={separatorClassName}
    />
  );

  if (layout === "stack") {
    return (
      <div className={`flex min-w-0 flex-col items-center text-center ${className}`.trim()}>
        <BrandMark brand={brand} size={logoSize} />
        <div className="mt-2.5 w-full">{title}</div>
        {subtitle ? <span className={`w-full ${subtitleClassName}`}>{subtitle}</span> : null}
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <BrandMark brand={brand} size={logoSize} className="shrink-0" />
      <div className="min-w-0">
        {title}
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
