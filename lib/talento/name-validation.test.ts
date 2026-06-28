import { describe, expect, it } from "node:test";
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
