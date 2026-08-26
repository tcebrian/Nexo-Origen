import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type NetworkReportGroupId = "bk" | "pp" | "sg" | "th" | "hambar" | "vault";

export const NETWORK_REPORT_GROUP_IDS: NetworkReportGroupId[] = ["bk", "pp", "sg", "th", "hambar", "vault"];

export function isNetworkReportGroupId(value: string): value is NetworkReportGroupId {
  return (NETWORK_REPORT_GROUP_IDS as string[]).includes(value);
}

export type NetworkReportGroup = {
  id: NetworkReportGroupId;
  label: string;
  sublabel?: string;
  /** Marcas (BrandId) que se agregan juntas en este informe. */
  brandIds: BrandId[];
};

/**
 * Ribs, Sibuya y Volapié comparten un único informe combinado ("Grupo
 * Hámbar"), tal y como los genera hoy el usuario a mano cada semana. El
 * resto de marcas van cada una por su cuenta.
 */
export const NETWORK_REPORT_GROUPS: Record<NetworkReportGroupId, NetworkReportGroup> = {
  bk: { id: "bk", label: "Burger King", brandIds: ["bk"] },
  pp: { id: "pp", label: "Popeyes", brandIds: ["pp"] },
  sg: { id: "sg", label: "Santa Gloria", brandIds: ["sg"] },
  th: { id: "th", label: "Tim Hortons", brandIds: ["th"] },
  hambar: {
    id: "hambar",
    label: "Grupo Hámbar",
    sublabel: "Ribs · Sibuya · Volapié",
    brandIds: ["ribs", "sibuya", "tv"],
  },
  vault: { id: "vault", label: "Vault", brandIds: ["vault"] },
};
