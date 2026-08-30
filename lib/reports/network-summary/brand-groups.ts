import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";

export type NetworkReportGroupId = "bk" | "pp" | "sg-es" | "sg-ad" | "th" | "hambar" | "vault";

export const NETWORK_REPORT_GROUP_IDS: NetworkReportGroupId[] = [
  "bk",
  "pp",
  "sg-es",
  "sg-ad",
  "th",
  "hambar",
  "vault",
];

export function isNetworkReportGroupId(value: string): value is NetworkReportGroupId {
  return (NETWORK_REPORT_GROUP_IDS as string[]).includes(value);
}

export type NetworkReportGroup = {
  id: NetworkReportGroupId;
  label: string;
  sublabel?: string;
  /** Marcas (BrandId) que se agregan juntas en este informe. */
  brandIds: BrandId[];
  /** Filtro extra dentro de la marca (p.ej. Santa Gloria España vs Andorra). */
  restaurantFilter?: (row: KpiRestaurantRow) => boolean;
};

/**
 * Ciudades de los locales de Santa Gloria en Andorra — Benlloch y Prat de la
 * Creu vienen con ciudad "Andorra" en Supabase, Pas de la Casa con su propio
 * nombre de parroquia. El resto de ciudades (Madrid, Logroño, Segovia...)
 * son España. Se compara por ciudad (no por id de restaurante) para que
 * cualquier local nuevo en Andorra se clasifique solo, sin tocar código.
 */
const ANDORRA_CIUDADES = new Set([
  "andorra",
  "andorra la vella",
  "pas de la casa",
  "encamp",
  "escaldes-engordany",
  "escaldes",
  "la massana",
  "ordino",
  "sant julià de lòria",
  "canillo",
]);

function isAndorraCiudad(ciudad: string): boolean {
  return ANDORRA_CIUDADES.has(ciudad.trim().toLowerCase());
}

/**
 * Ribs, Sibuya y Volapié comparten un único informe combinado ("Grupo
 * Hámbar"), tal y como los genera hoy el usuario a mano cada semana. Santa
 * Gloria se divide en dos informes (España / Andorra) porque son redes con
 * dinámicas de negocio distintas. El resto de marcas van cada una por su
 * cuenta.
 */
export const NETWORK_REPORT_GROUPS: Record<NetworkReportGroupId, NetworkReportGroup> = {
  bk: { id: "bk", label: "Burger King", brandIds: ["bk"] },
  pp: { id: "pp", label: "Popeyes", brandIds: ["pp"] },
  "sg-es": {
    id: "sg-es",
    label: "Santa Gloria España",
    sublabel: "Red de Restaurantes España",
    brandIds: ["sg"],
    restaurantFilter: (row) => !isAndorraCiudad(row.ciudad),
  },
  "sg-ad": {
    id: "sg-ad",
    label: "Santa Gloria Andorra",
    sublabel: "Red de Restaurantes Andorra",
    brandIds: ["sg"],
    restaurantFilter: (row) => isAndorraCiudad(row.ciudad),
  },
  th: { id: "th", label: "Tim Hortons", brandIds: ["th"] },
  hambar: {
    id: "hambar",
    label: "Grupo Hámbar",
    sublabel: "Ribs · Sibuya · Volapié",
    brandIds: ["ribs", "sibuya", "tv"],
  },
  vault: { id: "vault", label: "Vault", brandIds: ["vault"] },
};
