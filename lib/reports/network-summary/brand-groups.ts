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

/**
 * Empresa (cliente) a la que pertenece cada informe. Coincide con `empresas`
 * en Supabase: todas las marcas son de Grupo Hámbar salvo Vault, que es una
 * empresa aparte y nunca debe mezclarse con las demás en una descarga conjunta.
 */
export type NetworkReportEmpresa = "grupo-hambar" | "vault";

export type NetworkReportGroup = {
  id: NetworkReportGroupId;
  /** Empresa a la que pertenece (ver NetworkReportEmpresa). */
  empresa: NetworkReportEmpresa;
  label: string;
  sublabel?: string;
  /** Marcas (BrandId) que se agregan juntas en este informe. */
  brandIds: BrandId[];
  /** Filtro extra dentro de la marca (p.ej. Santa Gloria España vs Andorra). */
  restaurantFilter?: (row: KpiRestaurantRow) => boolean;
  /**
   * Hasta cuántas estrellas cuenta una reseña como "negativa" en el reparto
   * de motivos del informe. Por defecto 3 (reseñas de atención: 1-3★, como
   * hasta ahora). El informe de Grupo Hámbar usa 2 (1-2★), igual que su KPI
   * "Reseñas negativas", para que el reparto y el total cuadren.
   */
  negativeMaxStars?: 2 | 3;
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
  bk: { id: "bk", empresa: "grupo-hambar", label: "Burger King", brandIds: ["bk"] },
  pp: { id: "pp", empresa: "grupo-hambar", label: "Popeyes", brandIds: ["pp"] },
  "sg-es": {
    id: "sg-es",
    empresa: "grupo-hambar",
    label: "Santa Gloria España",
    sublabel: "Red de Restaurantes España",
    brandIds: ["sg"],
    restaurantFilter: (row) => !isAndorraCiudad(row.ciudad),
  },
  "sg-ad": {
    id: "sg-ad",
    empresa: "grupo-hambar",
    label: "Santa Gloria Andorra",
    sublabel: "Red de Restaurantes Andorra",
    brandIds: ["sg"],
    restaurantFilter: (row) => isAndorraCiudad(row.ciudad),
  },
  th: { id: "th", empresa: "grupo-hambar", label: "Tim Hortons", brandIds: ["th"] },
  hambar: {
    id: "hambar",
    empresa: "grupo-hambar",
    label: "Grupo Hámbar",
    sublabel: "Ribs · Sibuya · Volapié",
    brandIds: ["ribs", "sibuya", "tv"],
    negativeMaxStars: 2,
  },
  vault: { id: "vault", empresa: "vault", label: "Vault", brandIds: ["vault"] },
};
