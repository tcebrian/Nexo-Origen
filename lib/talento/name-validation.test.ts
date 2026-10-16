import { describe, expect, it } from "vitest";
import {
  extractPersonNamesFromComment,
  formatEmployeeDisplayName,
  isEmployeePersonName,
  sanitizeEmployeeFieldValue,
} from "./name-validation";

describe("isEmployeePersonName", () => {
  it("acepta nombres reales", () => {
    expect(isEmployeePersonName("José Martínez", { source: "field" })).toBe(true);
    expect(isEmployeePersonName("María", { source: "field" })).toBe(true);
    expect(isEmployeePersonName("Carlos", { source: "text" })).toBe(true);
  });

  it("rechaza motivos, marcas y palabras sueltas", () => {
    expect(isEmployeePersonName("Falta de producto", { source: "field" })).toBe(false);
    expect(isEmployeePersonName("Atención", { source: "text" })).toBe(false);
    expect(isEmployeePersonName("Excelente", { source: "text" })).toBe(false);
    expect(isEmployeePersonName("Burger", { source: "field", restaurantName: "Burger King Tudela" })).toBe(false);
    expect(isEmployeePersonName("Tudela", { source: "text", restaurantName: "Burger King Tudela" })).toBe(false);
    expect(isEmployeePersonName("Servicio", { source: "text" })).toBe(false);
    expect(isEmployeePersonName("Todo", { source: "text" })).toBe(false);
    expect(isEmployeePersonName("Caja", { source: "field" })).toBe(false);
  });
});

describe("extractPersonNamesFromComment", () => {
  it("extrae nombres con contexto claro", () => {
    const names = extractPersonNamesFromComment(
      "El camarero Pedro nos atendió genial, gracias a María por el trato.",
      "Burger King Tudela"
    );
    expect(names.map((n) => n.name).sort()).toEqual(["María", "Pedro"]);
  });

  it("reconoce sirvió y sirvio (con y sin tilde)", () => {
    expect(extractPersonNamesFromComment("Pedro nos sirvió").map((n) => n.name)).toEqual(["Pedro"]);
    expect(extractPersonNamesFromComment("Pedro nos sirvio").map((n) => n.name)).toEqual(["Pedro"]);
  });

  it("los disparadores no dependen de mayúsculas/minúsculas", () => {
    for (const text of ["GRACIAS A María", "gracias a María", "Gracias a María", "Gracias A María"]) {
      expect(extractPersonNamesFromComment(text).map((n) => n.name)).toEqual(["María"]);
    }
    expect(extractPersonNamesFromComment("CAMARERO Pedro").map((n) => n.name)).toEqual(["Pedro"]);
    expect(extractPersonNamesFromComment("ATENDIÓ Lucía").map((n) => n.name)).toEqual(["Lucía"]);
    expect(extractPersonNamesFromComment("Pedro NOS ATENDIÓ").map((n) => n.name)).toEqual(["Pedro"]);
  });

  it("sigue exigiendo mayúscula inicial en el nombre", () => {
    expect(extractPersonNamesFromComment("gracias a maría")).toHaveLength(0);
    const names = extractPersonNamesFromComment("El camarero Pedro nos atendió genial, gracias a María por el trato.");
    expect(names.map((n) => n.name).sort()).toEqual(["María", "Pedro"]);
  });

  it("no extrae palabras sueltas tras gracias sin 'a'", () => {
    const names = extractPersonNamesFromComment("Gracias todo estuvo bien", "BK Tudela");
    expect(names).toHaveLength(0);
  });
});

describe("sanitizeEmployeeFieldValue", () => {
  it("formatea y rechaza placeholders", () => {
    expect(sanitizeEmployeeFieldValue("josé martínez")).toBe("José Martínez");
    expect(sanitizeEmployeeFieldValue("N/A")).toBeNull();
    expect(sanitizeEmployeeFieldValue("sin nombre")).toBeNull();
    expect(sanitizeEmployeeFieldValue("Atención")).toBeNull();
  });
});

describe("formatEmployeeDisplayName", () => {
  it("respeta partículas", () => {
    expect(formatEmployeeDisplayName("maría de la cruz")).toBe("María de la Cruz");
  });
});
