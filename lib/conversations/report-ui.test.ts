import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(
  path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"),
  "utf-8"
);

describe("selector de informes de la interfaz", () => {
  it("obtiene tipos, formatos, periodos, restaurantes y redes del servidor", () => {
    expect(view).toContain("/api/conversations/report-options");
    expect(view).toContain("options.types");
    expect(view).toContain("type.formats");
    expect(view).toContain("type.periods");
    expect(view).toContain("options.groups");
    expect(view).toContain("options?.restaurants");
  });

  it("no tiene ningún tipo de informe ni formato hardcodeado (añadir uno no exige tocar el componente)", () => {
    for (const hardcoded of [
      '"monthly"',
      '"weekly"',
      '"quarterly"',
      '"semiannual"',
      '"annual"',
      "Informe mensual",
      "Informe semanal",
      "Informe trimestral",
      '"image"',
      '"pdf"',
    ]) {
      expect(view, hardcoded).not.toContain(hardcoded);
    }
  });

  it("el sujeto (restaurante o red) y los formatos dependen del tipo elegido", () => {
    expect(view).toContain('type.subject === "restaurant"');
  });
});
