import { brands } from "@/app/dashboard/restaurantes/data";
import { useAuth } from "../../_components/auth-context";
import { KpiCard } from "../../_components/kpi";
import { getBrandSnapshot } from "@/lib/restaurants/brand-stats";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import type { BrandId } from "@/app/dashboard/restaurantes/data";

type RestaurantesBrandKpisProps = {
  brand: "todas" | BrandId;
  operationalList: RestaurantOperational[];
};

export function RestaurantesBrandKpis({ brand, operationalList }: RestaurantesBrandKpisProps) {
  const { empresaNombre } = useAuth();
  const snapshot = getBrandSnapshot(operationalList, brand);
  const brandName =
    brand === "todas" ? empresaNombre : (brands.find((b) => b.id === brand)?.name ?? brand);

  const kpis = [
    {
      title: "MEDIA DE LA RED",
      value: snapshot.avgMedia,
      change: `${brandName} · periodo activo`,
      icon: "star" as const,
      positive: parseFloat(snapshot.avgMedia) >= 4.4,
      iconTone: "purple" as const,
    },
    {
      title: "LOCALES ACTIVOS",
      value: String(snapshot.count),
      change: `${snapshot.onTarget} en objetivo`,
      icon: "store" as const,
      positive: null,
      iconTone: "purple" as const,
    },
    {
      title: "EN RIESGO",
      value: String(snapshot.onWatch + snapshot.critical),
      change:
        snapshot.critical > 0
          ? `${snapshot.critical} crítico${snapshot.critical === 1 ? "" : "s"}`
          : "Sin alertas críticas",
      icon: "warning" as const,
      positive: snapshot.critical === 0 && snapshot.onWatch === 0,
      iconTone: (snapshot.critical > 0 ? "red" : "purple") as "purple" | "red",
    },
    {
      title: "PROTECCIÓN MEDIA",
      value: `${snapshot.avgProtection}%`,
      change: "Nivel Nexo Prevent de la selección",
      icon: "chat" as const,
      positive: snapshot.avgProtection >= 75,
      iconTone: "purple" as const,
    },
  ];

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </section>
  );
}
