"use client";



import type { BrandId } from "@/app/dashboard/restaurantes/data";

import { useAllBrandsLabel, useBrandFilterEnabled, useScopedBrands } from "../_hooks/use-scoped-brands";

import { AllBrandsMark } from "./all-brands-mark";

import { BrandMark } from "./brand-mark";



type AllBrandValue = "todas" | "todos";



type ScopedBrandRailProps<T extends AllBrandValue> = {

  allValue: T;

  allLabel?: string;

  selectedBrand: T | BrandId;

  onBrandChange: (brand: T | BrandId) => void;

  /** Marcas detectadas en los restaurantes/datos de la página (refuerza el alcance del perfil). */

  sourceBrands?: readonly BrandId[];

  className?: string;

  showLabel?: boolean;

  /** Muestra el rail aunque el perfil solo tenga una marca (p. ej. Nexo Prevent). */
  alwaysVisible?: boolean;

};



function BrandChip({

  active,

  onClick,

  label,

  children,

}: {

  active: boolean;

  onClick: () => void;

  label: string;

  children: React.ReactNode;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      aria-label={label}

      aria-pressed={active}

      className={`inline-flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all duration-200 ${

        active

          ? "border-[var(--nexo-accent)] bg-[var(--nexo-accent)] text-white shadow-[0_0_24px_rgba(124,58,237,0.28)]"

          : "border-[var(--nexo-border)] bg-[var(--nexo-card)] text-[var(--nexo-text-secondary)] hover:border-[var(--nexo-border-strong)] hover:text-[var(--nexo-text)]"

      }`}

    >

      <span className="flex h-7 w-[72px] items-center justify-center">{children}</span>

      <span className={`max-w-[132px] truncate text-[12px] font-medium ${active ? "text-white" : ""}`}>

        {label}

      </span>

    </button>

  );

}



/** Selector de marca con logo. Solo visible si el perfil puede ver más de una marca. */

export function ScopedBrandRail<T extends AllBrandValue>({

  allValue,

  allLabel,

  selectedBrand,

  onBrandChange,

  sourceBrands,

  className = "",

  showLabel = false,

  alwaysVisible = false,

}: ScopedBrandRailProps<T>) {

  const visibleBrands = useScopedBrands(sourceBrands);

  const enabled = useBrandFilterEnabled(sourceBrands);

  const defaultAllLabel = useAllBrandsLabel();



  if (!alwaysVisible && !enabled) return null;

  if (alwaysVisible && visibleBrands.length === 0) return null;



  const resolvedAllLabel = allLabel ?? defaultAllLabel;



  return (

    <section className={className}>

      {showLabel ? (

        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">

          Filtrar por marca

        </p>

      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">

        <BrandChip

          active={selectedBrand === allValue}

          label={resolvedAllLabel}

          onClick={() => onBrandChange(allValue)}

        >

          <AllBrandsMark size="xs" alt={resolvedAllLabel} />

        </BrandChip>



        {visibleBrands.map((brand) => (

          <BrandChip

            key={brand.id}

            active={selectedBrand === brand.id}

            label={brand.name}

            onClick={() => onBrandChange(brand.id)}

          >

            <BrandMark brand={brand.id} size="xs" />

          </BrandChip>

        ))}

      </div>

    </section>

  );

}


