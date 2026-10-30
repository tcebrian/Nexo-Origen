import { describe, expect, it } from "vitest";
import { buildBriefing } from "./briefing";
import { fixtureSnapshot } from "./briefing.test-helper";

const names = (restaurants: { name: string; brand: string }[]) =>
  buildBriefing(fixtureSnapshot("2026-10-13", restaurants.map((r, i) => ({ id: i + 1, average: 4.5, reviews: 10, ...r })))).restaurants
    .map((r) => r.displayName)
    .sort();

describe("nombre mostrado de Burger King", () => {
  it("no repite la abreviatura cuando el nombre ya la trae (marca + 'BK Soria')", () => {
    expect(names([{ brand: "Burger King", name: "Burger King BK Soria" }])).toEqual(["BK Soria"]);
  });

  it("'Burger King Soria' sigue abreviándose a 'BK Soria'", () => {
    expect(names([{ brand: "Burger King", name: "Burger King Soria" }])).toEqual(["BK Soria"]);
  });

  it("un nombre que ya empieza por BK no se toca", () => {
    expect(names([{ brand: "Burger King", name: "BK Huesca II" }])).toEqual(["BK Huesca II"]);
  });

  it("otras marcas no se alteran", () => {
    expect(names([{ brand: "Popeyes", name: "Popeyes Plaza" }])).toEqual(["Popeyes Plaza"]);
  });
});
