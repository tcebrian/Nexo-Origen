import { describe, expect, it } from "vitest";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import { NETWORK_REPORT_GROUPS, selectNetworkReportRestaurantIds } from "./brand-groups";

const HAMBAR = 1;
const VAULT = 2;
const OTHER_COMPANY = 4;

function row(restaurante_id: number, marca: string, empresa_id: number | null | undefined, ciudad = "Madrid"): KpiRestaurantRow {
  return {
    restaurante_id,
    restaurante: `Local ${restaurante_id}`,
    ciudad,
    marca,
    empresa_id,
    total_resenas: 0,
    media_total: 0,
    resenas_negativas: 0,
    resenas_positivas: 0,
    ultima_resena: null,
    estado: "",
    media_google: null,
    total_resenas_google: null,
  };
}

// Catálogo ficticio: otra empresa con marcas que la heurística confunde con Burger King
// ("… Burger" o marcas desconocidas) y una marca con el mismo nombre que una de Grupo Hámbar.
const catalog: KpiRestaurantRow[] = [
  row(1, "Burger King", HAMBAR),
  row(2, "Burger King", HAMBAR),
  row(3, "Ribs", HAMBAR),
  row(4, "Sibuya", HAMBAR),
  row(5, "Santa Gloria", HAMBAR, "Andorra"),
  row(10, "Vault", VAULT),
  row(20, "Otra Burger", OTHER_COMPANY),
  row(21, "Marca Desconocida", OTHER_COMPANY),
  row(22, "Sibuya", OTHER_COMPANY),
  row(30, "Burger King", null),
  row(31, "Burger King", undefined),
];

const select = (id: keyof typeof NETWORK_REPORT_GROUPS) =>
  selectNetworkReportRestaurantIds(NETWORK_REPORT_GROUPS[id], catalog, marcaToBrandId);

describe("selectNetworkReportRestaurantIds", () => {
  it("el informe de Burger King no incluye restaurantes de otra empresa aunque su marca se resuelva como BK", () => {
    expect(marcaToBrandId("Otra Burger")).toBe("bk");
    expect(marcaToBrandId("Marca Desconocida")).toBe("bk");
    expect(select("bk")).toEqual([1, 2]);
  });

  it("una marca con el mismo nombre en otra empresa no entra en el informe de Grupo Hámbar", () => {
    expect(select("hambar")).toEqual([3, 4]);
  });

  it("deny by default: un restaurante sin empresa no entra en ningún informe", () => {
    for (const id of Object.keys(NETWORK_REPORT_GROUPS) as (keyof typeof NETWORK_REPORT_GROUPS)[]) {
      expect(select(id)).not.toContain(30);
      expect(select(id)).not.toContain(31);
    }
  });

  it("mantiene la separación por empresa y el filtro extra del grupo", () => {
    expect(select("vault")).toEqual([10]);
    expect(select("sg-ad")).toEqual([5]);
    expect(select("sg-es")).toEqual([]);
  });
});
