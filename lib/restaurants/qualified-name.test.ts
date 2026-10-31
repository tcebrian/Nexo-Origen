import { describe, expect, it } from "vitest";
import { qualifyRestaurantName } from "./qualified-name";

describe("qualifyRestaurantName", () => {
  it("no repite la abreviatura de la marca", () => {
    expect(qualifyRestaurantName("Burger King", "BK Utebo")).toBe("BK Utebo");
  });
  it("antepone la marca cuando el nombre no la trae", () => {
    expect(qualifyRestaurantName("Burger King", "Soria")).toBe("Burger King Soria");
    expect(qualifyRestaurantName("Santa Gloria", "Caleido")).toBe("Santa Gloria Caleido");
  });
  it("no la antepone si el nombre ya contiene la marca", () => {
    expect(qualifyRestaurantName("Santa Gloria", "Santa Gloria Caleido")).toBe("Santa Gloria Caleido");
  });
  it("sin marca devuelve el nombre", () => {
    expect(qualifyRestaurantName("", "Ribs Lleida")).toBe("Ribs Lleida");
  });
  it("una marca de una palabra no confunde su inicial", () => {
    expect(qualifyRestaurantName("Popeyes", "P Centro")).toBe("Popeyes P Centro");
  });
});
