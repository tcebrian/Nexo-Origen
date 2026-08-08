import { AllBrandsMark } from "./all-brands-mark";
import { useAuth } from "./auth-context";
import { glass } from "./ui/nexo-styles";

type TenantBadgeProps = {
  showLabel?: boolean;
  logoSize?: "chip" | "xs" | "sm";
};

export function TenantBadge({ showLabel = true, logoSize = "sm" }: TenantBadgeProps) {
  const { empresaNombre } = useAuth();
  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm ${glass}`}>
      {showLabel ? (
        <span className="text-[var(--nexo-text-tertiary)]">Empresa</span>
      ) : null}
      <AllBrandsMark size={logoSize} alt={empresaNombre} />
    </div>
  );
}
