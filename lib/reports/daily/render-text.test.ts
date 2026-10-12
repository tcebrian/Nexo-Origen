import { describe, expect, it } from "vitest";
import { slotForDate } from "./calendar";
import { REPORT_MESSAGE_LIMIT, renderDailyReport, renderDailyReportLines } from "./render-text";
import { buildSnapshot, isDailyReportSnapshot, restaurantStatus, type DailyReportSnapshot, type SnapshotRestaurant } from "./snapshot";

const restaurant = (over: Partial<SnapshotRestaurant> & { id: number; name: string }): SnapshotRestaurant => ({
  brand: "Burger King",
  reviews: 0,
  ratingSum: 0,
  positive: 0,
  neutral: 0,
  negative: 0,
  topReason: null,
  ...over,
});

function snapshotOf(slotDate: string, restaurants: SnapshotRestaurant[]): DailyReportSnapshot {
  return {
    ...buildSnapshot({
      slot: slotForDate(slotDate),
      restaurants: [],
      metrics: new Map(),
      reasons: new Map(),
    }),
    restaurants,
  };
}

const weekToDate = snapshotOf("2026-10-21", [
  restaurant({ id: 1, name: "Restaurante A", reviews: 8, ratingSum: 36.8, positive: 7, neutral: 1, negative: 0 }),
  restaurant({ id: 2, name: "Restaurante B", reviews: 11, ratingSum: 46.2, positive: 8, neutral: 2, negative: 1, topReason: "Tiempo de espera" }),
  restaurant({ id: 3, name: "Restaurante C", reviews: 9, ratingSum: 34.2, positive: 4, neutral: 2, negative: 3, topReason: "Atención del personal" }),
  restaurant({ id: 4, name: "Restaurante D" }),
]);

describe("estado de un restaurante", () => {
  it("≥ 4,4 verde · ≥ 4,0 amarillo · menos rojo · sin reseñas, sin estado", () => {
    const status = (reviews: number, average: number) => restaurantStatus({ reviews, ratingSum: reviews * average });
    expect(status(10, 4.6)).toBe("green");
    expect(status(10, 4.4)).toBe("green");
    expect(status(10, 4.39)).toBe("yellow");
    expect(status(10, 4.0)).toBe("yellow");
    expect(status(10, 3.99)).toBe("red");
    expect(status(0, 0)).toBe("none");
  });
});

describe("semana en curso", () => {
  const text = renderDailyReport(weekToDate).join("\n");

  it("cabecera, periodo y actualización a las 09:00", () => {
    expect(text).toContain("📊 Nexo Origen · Semana en curso");
    expect(text).toContain("📅 Del 19 al 21 de octubre de 2026");
    expect(text).toContain("🕘 Actualizado: miércoles 21 de octubre · 09:00");
  });

  it("métricas globales calculadas con las cifras del snapshot", () => {
    expect(text).toContain("⭐ Media global: 4,19");
    expect(text).toContain("💬 Reseñas: 28");
    expect(text).toContain("✅ Positivas: 19");
    expect(text).toContain("➖ Neutras: 5");
    expect(text).toContain("🚨 Negativas: 4");
  });

  it("una marca: fuera de objetivo (peor primero), en objetivo (mejor primero) y sin reseñas al final", () => {
    expect(text).toContain("🍔 BURGER KING");
    const rows = text.split("\n").filter((line) => /^(🟢|🟡|🔴|⚪) /.test(line));
    expect(rows).toEqual([
      "🔴 Restaurante C · 3,80 · 9 reseñas",
      "🟡 Restaurante B · 4,20 · 11 reseñas",
      "🟢 Restaurante A · 4,60 · 8 reseñas",
      "⚪ Restaurante D · sin reseñas",
    ]);
    expect(text.indexOf("🚨 Fuera de objetivo")).toBeLessThan(text.indexOf("✅ En objetivo"));
  });

  it("prioridades con negativas y motivo principal", () => {
    expect(text).toContain("🚨 Prioridades");
    expect(text).toContain("• Restaurante C · 3 negativas · motivo principal: Atención del personal");
    expect(text).toContain("• Restaurante B · 1 negativa · motivo principal: Tiempo de espera");
    expect(text).not.toContain("📌 Semana cerrada");
  });
});

describe("cierre semanal", () => {
  const closure = snapshotOf("2026-10-19", weekToDate.restaurants);
  const text = renderDailyReport(closure).join("\n");

  it("se identifica como resultado FINAL y termina con 'Semana cerrada'", () => {
    expect(text).toContain("✅ Nexo Origen · Cierre semanal");
    expect(text).toContain("📅 Semana del 12 al 18 de octubre de 2026");
    expect(text).toContain("Resultado FINAL de la semana");
    expect(text.trimEnd().endsWith("📌 Semana cerrada.")).toBe(true);
  });
});

describe("0 reseñas es un resultado válido", () => {
  const empty = snapshotOf("2026-10-22", [restaurant({ id: 1, name: "Restaurante A" }), restaurant({ id: 2, name: "Restaurante B" })]);
  const text = renderDailyReport(empty).join("\n");

  it("muestra ceros y guion en la media, y sin prioridades", () => {
    expect(text).toContain("💬 Reseñas: 0");
    expect(text).toContain("⭐ Media global: —");
    expect(text).toContain("⚪ Restaurante A · sin reseñas");
    expect(text).toContain("✅ Sin reseñas negativas ni restaurantes en rojo en este periodo.");
  });
});

describe("permisos vigentes al pulsar", () => {
  it("oculta los restaurantes retirados y recalcula los totales SOLO con las cifras del snapshot", () => {
    const text = renderDailyReport(weekToDate, { allowedRestaurantIds: new Set([1, 2]) }).join("\n");
    expect(text).toContain("Restaurante A");
    expect(text).not.toContain("Restaurante C");
    expect(text).toContain("💬 Reseñas: 19");
    expect(text).toContain("ya no están asignados");
  });

  it("sin ocultar nada no aparece ningún aviso", () => {
    const text = renderDailyReport(weekToDate, { allowedRestaurantIds: new Set([1, 2, 3, 4]) }).join("\n");
    expect(text).not.toContain("ya no están asignados");
  });
});

describe("mensajes largos", () => {
  const many = snapshotOf(
    "2026-10-21",
    Array.from({ length: 160 }, (_, index) =>
      restaurant({ id: index + 1, name: `Burger King Restaurante número ${index + 1}`, reviews: 5, ratingSum: 21 + (index % 4), positive: 4, neutral: 1, negative: index % 3 === 0 ? 1 : 0, topReason: index % 3 === 0 ? "Tiempo de espera" : null })
    )
  );

  it("se divide en varios mensajes ordenados sin superar el límite", () => {
    const messages = renderDailyReport(many);
    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) expect(Array.from(message).length).toBeLessThanOrEqual(REPORT_MESSAGE_LIMIT);
    expect(messages[0]).toContain("Nexo Origen · Semana en curso");
  });

  it("no trunca ni pierde ningún restaurante, y nunca corta una línea", () => {
    const messages = renderDailyReport(many);
    const joined = messages.join("\n");
    for (let id = 1; id <= 160; id++) expect(joined).toContain(`Burger King Restaurante número ${id} ·`);
    const lines = renderDailyReportLines(many).filter((line) => line !== "");
    expect(messages.join("\n").split("\n").filter((line) => line !== "")).toEqual(lines);
  });
});

describe("snapshot", () => {
  it("se construye con el slot (no con la hora real) y valida su forma", () => {
    const slot = slotForDate("2026-10-21");
    const built = buildSnapshot({
      slot,
      restaurants: [{ id: 5, name: "Zizur", brand: "Burger King" }],
      metrics: new Map([[5, { reviews: 4, ratingSum: 18, positive: 3, neutral: 1, negative: 0 }]]),
      reasons: new Map(),
    });
    expect(built).toMatchObject({
      version: 1,
      kind: "WEEK_TO_DATE",
      slotDate: "2026-10-21",
      slotAt: "2026-10-21T09:00:00",
      period: { start: "2026-10-19T00:00:00", end: "2026-10-21T09:00:00" },
    });
    expect(isDailyReportSnapshot(built)).toBe(true);
    expect(isDailyReportSnapshot({ version: 2 })).toBe(false);
    expect(isDailyReportSnapshot(null)).toBe(false);
    // Un restaurante sin filas en la ventana es 0 reseñas, no un error.
    const empty = buildSnapshot({ slot, restaurants: [{ id: 9, name: "X", brand: "" }], metrics: new Map(), reasons: new Map() });
    expect(empty.restaurants[0]).toMatchObject({ reviews: 0, ratingSum: 0 });
  });

  it("el cierre semanal usa las 09:00 del lunes como momento del slot", () => {
    const built = buildSnapshot({ slot: slotForDate("2026-10-19"), restaurants: [], metrics: new Map(), reasons: new Map() });
    expect(built.slotAt).toBe("2026-10-19T09:00:00");
    expect(built.period.end).toBe("2026-10-19T00:00:00");
  });
});

describe("orden por marcas y objetivo", () => {
  const r = (id: number, brand: string, name: string, average: number, reviews: number, negative = 0) =>
    restaurant({ id, brand, name, reviews, ratingSum: average * reviews, negative, positive: reviews - negative });
  const multi = snapshotOf("2026-10-21", [
    r(1, "Santa Gloria", "SG Zaragoza", 4.9, 5),
    r(2, "Zeta Food", "Zeta Uno", 4.5, 4),
    r(3, "Burger King", "BK Andorra", 4.67, 6),
    r(4, "Popeyes", "Popeyes Centro", 4.1, 7, 1),
    r(5, "Burger King", "BK Soria", 3.7, 10, 3),
    r(6, "Burger King", "BK Huesca", 4.52, 3),
    r(7, "Burger King", "BK Calahorra", 4.08, 6, 1),
    r(8, "Tim Hortons", "Tim Norte", 4.45, 8),
    r(9, "Alfa Food", "Alfa Uno", 3.9, 5, 2),
    r(10, "Burger King", "BK Borde", 4.4, 5),
    r(11, "Burger King", "BK Casi", 4.39, 5),
  ]);
  const lines = renderDailyReportLines(multi);

  it("marcas en orden preferente y el resto alfabético", () => {
    const headers = lines.filter((line) => /^(🍔|🍗|☕|🥐|🏪) [A-Z]/.test(line));
    expect(headers).toEqual(["🍔 BURGER KING", "🍗 POPEYES", "☕ TIM HORTONS", "🥐 SANTA GLORIA", "🏪 ALFA FOOD", "🏪 ZETA FOOD"]);
  });

  it("dentro de la marca: fuera de objetivo ascendente y en objetivo descendente; 4,40 ya está en objetivo", () => {
    const start = lines.indexOf("🍔 BURGER KING");
    const end = lines.indexOf("🍗 POPEYES");
    expect(lines.slice(start, end).filter((line) => line !== "")).toEqual([
      "🍔 BURGER KING",
      "🚨 Fuera de objetivo",
      "🔴 BK Soria · 3,70 · 10 reseñas",
      "🟡 BK Calahorra · 4,08 · 6 reseñas",
      "🟡 BK Casi · 4,39 · 5 reseñas",
      "✅ En objetivo",
      "🟢 BK Andorra · 4,67 · 6 reseñas",
      "🟢 BK Huesca · 4,52 · 3 reseñas",
      "🟢 BK Borde · 4,40 · 5 reseñas",
    ]);
  });

  it("sin fuera de objetivo: 'Todos en objetivo'; sin en objetivo: solo el bloque fuera de objetivo; sin encabezados vacíos", () => {
    const text = lines.join("\n");
    expect(text).toContain("☕ TIM HORTONS\n\n✅ Todos los restaurantes están en objetivo\n🟢 Tim Norte");
    expect(text).toContain("🍗 POPEYES\n\n🚨 Fuera de objetivo\n🟡 Popeyes Centro");
    const popeyes = lines.slice(lines.indexOf("🍗 POPEYES"), lines.indexOf("☕ TIM HORTONS")).join("\n");
    expect(popeyes).not.toContain("✅ En objetivo");
    expect(text).not.toMatch(/(🚨 Fuera de objetivo|✅ En objetivo)\n\n/);
  });

  it("cada restaurante sale una sola vez en el listado", () => {
    const rows = lines.filter((line) => /^(🟢|🟡|🔴|⚪) /.test(line));
    expect(rows).toHaveLength(11);
    expect(new Set(rows).size).toBe(11);
  });

  it("prioridades: marca, más negativas y peor media; el resumen global se mantiene", () => {
    const start = lines.indexOf("🚨 Prioridades");
    expect(lines.slice(start + 1).filter((line) => line.startsWith("• ")).map((line) => line.split(" · ")[0])).toEqual([
      "• BK Soria",
      "• BK Calahorra",
      "• Popeyes Centro",
      "• Alfa Uno",
    ]);
    expect(lines).toContain("💬 Reseñas: 64");
    expect(lines.some((line) => line.startsWith("⭐ Media global:"))).toBe(true);
  });
});
