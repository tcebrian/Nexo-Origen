import { describe, expect, it } from "vitest";
import { buildBriefing } from "./briefing";
import { fixtureSnapshot, multiBrandFixture, type FixtureRestaurant } from "./briefing.test-helper";
import { comparisonWindowEnd, slotForDate } from "./calendar";
import { REPORT_MESSAGE_LIMIT, renderDailyReport, renderDailyReportLines } from "./render-text";
import {
  buildSnapshot,
  isDailyReportSnapshot,
  positivesNeeded,
  restaurantStatus,
  type DailyReportSnapshot,
} from "./snapshot";

const SEP = "━━━━━━━━━━━━━━";
const TUESDAY = "2026-10-13";
const MONDAY = "2026-10-12";

const weekToDate = fixtureSnapshot(TUESDAY, multiBrandFixture());
const text = (snapshot: DailyReportSnapshot, options?: Parameters<typeof renderDailyReport>[1]) => renderDailyReport(snapshot, options).join("\n\n");

describe("estado, objetivo y positivas necesarias", () => {
  it("🟢 ≥ objetivo de la marca · 🟡 ≥ 4,00 y < objetivo · 🔴 < 4,00 · ⭕ sin reseñas (media real, sin redondear)", () => {
    const status = (reviews: number, average: number, target?: number) => restaurantStatus({ reviews, ratingSum: reviews * average }, target);
    // Burger King, objetivo 4,40.
    expect(status(10, 4.45, 4.4)).toBe("green");
    expect(status(10, 4.2, 4.4)).toBe("yellow");
    expect(status(10, 3.9, 4.4)).toBe("red");
    // Vault, objetivo 4,70.
    expect(status(10, 4.75, 4.7)).toBe("green");
    expect(status(10, 4.6, 4.7)).toBe("yellow");
    expect(status(10, 3.9, 4.7)).toBe("red");
    // Límites: el rojo es SIEMPRE < 4,00, también con objetivo 4,70.
    expect(status(10, 4.0, 4.4)).toBe("yellow");
    expect(status(10, 3.99, 4.4)).toBe("red");
    expect(status(10, 4.0, 4.7)).toBe("yellow");
    expect(status(10, 4.3, 4.7)).toBe("yellow");
    expect(status(10, 3.99, 4.7)).toBe("red");
    expect(status(1000, 4.395, 4.4)).toBe("yellow");
    expect(status(10, 4.4)).toBe("green"); // objetivo por defecto 4,4
    expect(status(0, 0)).toBe("none");
  });

  it("en objetivo / fuera de objetivo usa exactamente la misma regla (Vault 4,60 con objetivo 4,70 está fuera)", () => {
    const briefing = buildBriefing(weekToDate);
    const vault = briefing.restaurants.find((r) => r.id === 13)!;
    expect(vault).toMatchObject({ status: "yellow", target: 4.7 });
    expect(briefing.counts.offTarget).toBe(
      briefing.restaurants.filter((r) => r.status === "yellow" || r.status === "red").length
    );
    expect(briefing.counts.onTarget).toBe(briefing.restaurants.filter((r) => r.status === "green").length);
  });

  it("positivas necesarias: el menor n con (suma + 5n) / (reseñas + n) ≥ objetivo", () => {
    expect(positivesNeeded(10, 37, 4.4)).toBe(12); // 3,70 con 10 reseñas
    expect(positivesNeeded(20, 87, 4.4)).toBe(2); // 4,35 con 20 reseñas
    expect(positivesNeeded(5, 21, 4.4)).toBe(2); // 4,20 con 5 reseñas
    expect(positivesNeeded(10, 44, 4.4)).toBe(0); // ya en objetivo
    expect(positivesNeeded(10, 46, 4.7)).toBe(4); // objetivo de otra marca
    expect(positivesNeeded(0, 0, 4.4)).toBeNull();
    expect(positivesNeeded(10, 37, 5)).toBeNull(); // inalcanzable
  });

  it("coincide con la búsqueda por fuerza bruta y es mínimo", () => {
    for (const target of [4.0, 4.4, 4.5, 4.7, 4.9]) {
      for (let reviews = 1; reviews <= 40; reviews++) {
        for (let sum = reviews; sum <= reviews * 5; sum += 1) {
          let expected = 0;
          while ((sum + 5 * expected) / (reviews + expected) < target) expected += 1;
          expect(positivesNeeded(reviews, sum, target)).toBe(expected);
        }
      }
    }
  });
});

describe("calendario de comparación", () => {
  it("mismo inicio y fin a las 09:00 del día anterior; el cierre del lunes frente al domingo 09:00", () => {
    const friday = slotForDate("2026-10-16");
    expect(friday.periodStart).toBe("2026-10-12T00:00:00");
    expect(comparisonWindowEnd(friday)).toBe("2026-10-15T09:00:00"); // jueves 09:00
    expect(comparisonWindowEnd(slotForDate(TUESDAY))).toBe("2026-10-12T09:00:00"); // lunes 09:00
    const closure = slotForDate(MONDAY);
    expect(closure.kind).toBe("WEEKLY_CLOSURE");
    expect(closure.periodStart).toBe("2026-10-05T00:00:00");
    expect(comparisonWindowEnd(closure)).toBe("2026-10-11T09:00:00"); // domingo 09:00
  });
});

describe("snapshot v2", () => {
  it("guarda objetivo, empresa, comparación y negativas nuevas, y congela la forma", () => {
    expect(weekToDate).toMatchObject({
      version: 2,
      kind: "WEEK_TO_DATE",
      slotDate: TUESDAY,
      slotAt: "2026-10-13T09:00:00",
      period: { start: "2026-10-12T00:00:00", end: "2026-10-13T09:00:00" },
      comparison: { reference: "DAY_BEFORE", previousPeriodEnd: "2026-10-12T09:00:00" },
    });
    const soria = weekToDate.restaurants.find((r) => r.id === 1)!;
    expect(soria).toMatchObject({ company: "Grupo Demo", target: 4.4, previous: { reviews: 9 }, newNegativeCount: 1 });
    expect(soria.newNegatives).toEqual([
      { stars: 1, at: "2026-10-13T07:42:10", reason: "Tiempo de espera", excerpt: "Demora en el servicio, más de 40 minutos esperando el pedido" },
    ]);
    expect(weekToDate.restaurants.find((r) => r.id === 13)!.target).toBe(4.7);
    // Un restaurante sin actividad hoy ni ayer sigue en el snapshot con ceros.
    expect(weekToDate.restaurants.find((r) => r.id === 15)).toMatchObject({ reviews: 0, previous: { reviews: 0 } });
    expect(isDailyReportSnapshot(weekToDate)).toBe(true);
  });

  it("el cierre semanal compara contra el domingo; se guardan 5 negativas pero se cuenta el total", () => {
    const many = fixtureSnapshot(MONDAY, [
      {
        id: 1, brand: "Burger King", name: "Burger King X", average: 3, reviews: 10, negative: 7,
        newNegatives: Array.from({ length: 7 }, (_, i) => ({ stars: 1, reason: null, excerpt: null, at: `2026-10-11T1${i}:00:00` })),
      },
    ]);
    expect(many.comparison).toEqual({ reference: "SUNDAY", previousPeriodEnd: "2026-10-11T09:00:00" });
    expect(many.restaurants[0]!.newNegatives).toHaveLength(5);
    expect(many.restaurants[0]!.newNegativeCount).toBe(7);
  });

  it("un snapshot v1 (sin campos nuevos) sigue siendo válido y se renderiza sin comparación", () => {
    const v1: DailyReportSnapshot = {
      version: 1,
      kind: "WEEK_TO_DATE",
      slotDate: TUESDAY,
      slotAt: "2026-10-13T09:00:00",
      period: { start: "2026-10-12T00:00:00", end: "2026-10-13T09:00:00", firstDay: "2026-10-12", lastDay: TUESDAY },
      restaurants: [{ id: 1, name: "Burger King Soria", brand: "Burger King", reviews: 10, ratingSum: 37, positive: 7, neutral: 0, negative: 3, topReason: null }],
    };
    expect(isDailyReportSnapshot(v1)).toBe(true);
    const out = text(v1);
    expect(out).toContain("📊 *INFORME DIARIO*");
    expect(out).toContain("+12 positivas");
    expect(out).not.toContain("Evolución");
    expect(isDailyReportSnapshot({ version: 3 })).toBe(false);
  });
});

describe("cabecera y leyenda", () => {
  const head = renderDailyReport(weekToDate)[0]!;

  it("semana en curso: fecha de hoy y periodo lunes-domingo COMPLETO, con la empresa de los datos", () => {
    expect(head.split("\n").slice(0, 6)).toEqual([
      SEP,
      "📊 *INFORME DIARIO*",
      "📅 13 de octubre de 2026",
      "📆 Periodo: *12 al 18 de octubre*",
      "🏤 Grupo Demo",
      SEP,
    ]);
  });

  it("objetivos distintos: lista el objetivo de cada marca y no muestra umbrales '≥ 4,40'", () => {
    expect(head).toContain(
      "🎯 *Objetivos*\nBurger King: *4,40⭐* · Popeyes: *4,40⭐* · Santa Gloria: *4,40⭐* · Tim Hortons: *4,40⭐* · Ribs: *4,40⭐* · Sibuya: *4,40⭐* · Vault: *4,70⭐*"
    );
    expect(head).toContain("🔴 Crítico · 🟡 En vigilancia · 🟢 En objetivo");
    expect(head).not.toMatch(/media [<≥]/);
    expect(head).not.toContain("🎯 *Objetivo:");
    expect(head).toContain("⚠️ Poco volumen: entre 1 y 6 reseñas");
    expect(head).toContain("⭕ Sin actividad: 0 reseñas");
  });

  it("mismo objetivo en todas las marcas visibles: una sola línea de objetivo", () => {
    const onlyBk = fixtureSnapshot(TUESDAY, multiBrandFixture().filter((r) => r.brand !== "Vault"));
    const legend = renderDailyReport(onlyBk)[0]!;
    expect(legend).toContain("🎯 *Objetivo: 4,40⭐*\n🔴 Crítico · 🟡 En vigilancia · 🟢 En objetivo");
    expect(legend).not.toContain("🎯 *Objetivos*");
    expect(legend).not.toMatch(/media [<≥]/);
  });

  it("cierre semanal: semana cerrada completa y 'Semana cerrada' al final", () => {
    const closure = fixtureSnapshot(MONDAY, multiBrandFixture());
    const messages = renderDailyReport(closure);
    expect(messages[0]).toContain("✅ *CIERRE SEMANAL*");
    expect(messages[0]).toContain("📅 12 de octubre de 2026");
    expect(messages[0]).toContain("📆 Periodo cerrado: *5 al 11 de octubre*");
    expect(messages[0]).toContain("*Evolución frente al domingo (09:00)*");
    expect(messages.at(-1)!.trimEnd().endsWith("📌 *Semana cerrada.*")).toBe(true);
    // El informe en curso no lo lleva.
    expect(text(weekToDate)).not.toContain("Semana cerrada");
  });

  it("sin datos de empresa no se inventa ninguna", () => {
    const anonymous = fixtureSnapshot(TUESDAY, multiBrandFixture().map((r) => ({ ...r, company: null })));
    expect(renderDailyReport(anonymous)[0]).not.toContain("🏤");
  });
});

describe("resumen ejecutivo y evolución", () => {
  const head = renderDailyReport(weekToDate)[0]!;

  it("media ponderada, totales y restaurantes en/fuera/sin actividad", () => {
    expect(head).toContain("⭐ Media global: *4,39*");
    expect(head).toContain("📊 Reseñas: *117*");
    expect(head).toContain("✅ 107 positivas · ➖ 2 neutras · 🔴 8 negativas");
    expect(head).toContain("🟢 5 restaurantes en objetivo");
    expect(head).toContain("🔴🟡 7 restaurantes fuera de objetivo");
    expect(head).toContain("⭕ 3 restaurantes sin reseñas");
  });

  it("evolución desde ayer calculada con las cifras de la ventana anterior del snapshot", () => {
    expect(head).toContain("*Evolución desde ayer*");
    expect(head).toContain("⭐ 4,41 → *4,39 (-0,02)*");
    expect(head).toContain("📊 109 → *117 (+8)*");
    expect(head).toContain("🔴 6 → *8 negativas (+2)*");
  });

  it("lectura ejecutiva determinista y respaldada por las cifras", () => {
    // Hay objetivos distintos (Vault 4,70): la media global no se compara contra un único objetivo.
    expect(head).toContain("La media global es 4,39⭐, y baja 0,02 desde ayer.");
    expect(head).not.toContain("por debajo del objetivo");
    expect(head).toContain("El dato a vigilar es el aumento de negativas: 2 nuevas desde ayer.");
  });

  it("con un único objetivo sí compara la media global contra él", () => {
    const uniform = fixtureSnapshot(TUESDAY, [
      { id: 1, brand: "Burger King", name: "Burger King Soria", average: 4.2, reviews: 10, previous: { average: 4.2, reviews: 9 } },
    ]);
    expect(renderDailyReport(uniform)[0]).toContain("La media global (4,20⭐) está por debajo del objetivo de 4,40⭐.");
  });

  it("sin comparación (snapshot sin ventana anterior) no se inventa ninguna evolución", () => {
    const noComparison = fixtureSnapshot(TUESDAY, multiBrandFixture(), { comparison: false });
    expect(noComparison.comparison).toBeNull();
    const out = renderDailyReport(noComparison)[0]!;
    expect(out).not.toContain("Evolución");
    expect(out).not.toContain("desde ayer");
  });
});

describe("prioridades", () => {
  const priorities = renderDailyReport(weekToDate)[1]!;

  it("no son todos los restaurantes: solo rojos, amarillos con negativas y los que tienen negativas nuevas", () => {
    expect(priorities).toContain("🚨 *PRIORIDADES*");
    for (const absent of ["BK Zizur", "BK Andorra", "BK Huesca", "BK Calahorra", "Tim Hortons", "Vault", "Sibuya"]) {
      expect(priorities).not.toContain(absent);
    }
  });

  it("orden: fuera de objetivo con negativas, peor media primero", () => {
    const names = [...priorities.matchAll(/^(?:🔴|🟡|🟢) \*(.+?) · /gm)].map((m) => m[1]);
    expect(names).toEqual(["BK Soria", "Ribs Zaragoza", "Santa Gloria Huesca", "Popeyes Centro", "Popeyes Andorra"]);
  });

  it("para cada una: media, reseñas, ⚠️ con poco volumen, negativas y positivas necesarias", () => {
    expect(priorities).toContain("🔴 *BK Soria · 3,70⭐*\n10 reseñas · 3 negativas · +12 positivas");
    expect(priorities).toContain("🟡 *Santa Gloria Huesca · 4,20⭐*\n5 reseñas ⚠️ · 1 negativa · +2 positivas");
    expect(priorities).toContain("🟡 *Popeyes Andorra · 4,35⭐*\n20 reseñas · 1 negativa · +2 positivas");
    expect(priorities).toContain("_«+N positivas» = reseñas de 5⭐ nuevas necesarias para llegar al objetivo._");
  });

  it("deterioro y nueva negativa con motivo y resumen del snapshot", () => {
    expect(priorities).toContain("🚨 Principal foco: 3 negativas en 10 reseñas.");
    expect(priorities).toContain("📉 Baja desde 4,00⭐ tras 1 nueva negativa.");
    expect(priorities).toContain("🆕 Nueva 1⭐ · Tiempo de espera · _“Demora en el servicio, más de 40 minutos esperando el pedido”_");
    expect(priorities).toContain("🆕 Nueva 2⭐ · Calidad del producto · _“Pollo frío y poco crujiente”_");
  });

  it("termina con el aviso de verificación interna", () => {
    expect(priorities.trimEnd().endsWith("_Las incidencias reflejan opiniones de clientes y deben verificarse internamente._")).toBe(true);
  });

  it("una negativa nueva sobre un restaurante EN objetivo también es prioridad", () => {
    const snapshot = fixtureSnapshot(TUESDAY, [
      {
        id: 1, brand: "Popeyes", name: "Popeyes Centro", average: 4.6, reviews: 10, negative: 1, previous: { average: 4.7, reviews: 9 },
        newNegatives: [{ stars: 2, reason: null, excerpt: null, at: "2026-10-13T08:00:00" }],
      },
    ]);
    const out = renderDailyReport(snapshot)[1]!;
    expect(out).toContain("🟢 *Popeyes Centro · 4,60⭐*");
    expect(out).toContain("🆕 Nueva 2⭐ · sin motivo identificado");
    expect(out).not.toContain("positivas\n"); // en objetivo: sin "+X positivas"
  });

  it("sin nada que priorizar lo dice y no muestra el aviso", () => {
    const calm = fixtureSnapshot(TUESDAY, [{ id: 1, brand: "Popeyes", name: "Popeyes Centro", average: 4.8, reviews: 10, previous: { average: 4.8, reviews: 9 } }]);
    const out = renderDailyReport(calm)[1]!;
    expect(out).toContain("✅ Sin restaurantes fuera de objetivo con negativas ni negativas nuevas");
    expect(out).not.toContain("verificarse");
  });

  it("más de 8 prioridades: se indica cuántas faltan, nunca se corta en silencio", () => {
    const red: FixtureRestaurant[] = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1, brand: "Burger King", name: `Burger King Local ${i + 1}`, average: 3 + i * 0.05, reviews: 10, negative: 3,
    }));
    const out = renderDailyReport(fixtureSnapshot(TUESDAY, red))[1]!;
    expect((out.match(/^🔴 \*/gm) ?? []).length).toBe(8);
    expect(out).toContain("Y 3 restaurantes prioritarios más");
  });
});

describe("bloques por marca", () => {
  const all = text(weekToDate);
  const blocks = renderDailyReport(weekToDate).slice(2, -1).join("\n\n");

  it("orden BK, Popeyes, Santa Gloria, Tim Hortons y el resto agrupado; marca con cabecera y media", () => {
    const headers = [...blocks.matchAll(/^(🍔|🍗|🥐|☕|📍) \*(.+)\*$/gm)].map((m) => m[2]);
    expect(headers).toEqual(["BURGER KING", "POPEYES", "SANTA GLORIA", "TIM HORTONS", "RESTO"]);
    expect(blocks).toContain(`${SEP}\n🍔 *BURGER KING*\n*4,37⭐ · 35 reseñas*\n${SEP}`);
  });

  it("dentro de la marca: rojos, amarillos, luego en objetivo (mejor primero) y sin actividad", () => {
    const bk = blocks.slice(blocks.indexOf("🍔 *BURGER KING*"), blocks.indexOf("🍗 *POPEYES*"));
    const rows = bk.split("\n").filter((line) => /^(🔴|🟡|🟢|⭕) /.test(line));
    expect(rows).toEqual([
      "🔴 BK Soria · *3,70⭐* · 10",
      "🟡 BK Calahorra · *4,08⭐* · 6 ⚠️",
      "🟢 BK Zizur · *5,00⭐* · 10",
      "🟢 BK Andorra · *4,67⭐* · 6 ⚠️",
      "🟢 BK Huesca · *4,52⭐* · 3 ⚠️",
      "⭕ *SIN ACTIVIDAD*",
      "⭕ BK Barbastro",
      "⭕ BK Calatayud",
    ]);
    expect(bk).toContain("⭕ *SIN ACTIVIDAD*");
  });

  it("⚠️ solo con 1-6 reseñas (7 no, 6 sí)", () => {
    expect(blocks).toContain("🟡 Popeyes Centro · *4,30⭐* · 7\n");
    expect(blocks).toContain("🟡 BK Calahorra · *4,08⭐* · 6 ⚠️");
  });

  it("marcas con un solo local van a RESTO, cada una con su objetivo (Vault 4,7 → amarillo)", () => {
    const resto = blocks.slice(blocks.indexOf("📍 *RESTO*"));
    expect(resto).toContain("🔴 Ribs Zaragoza · *3,90⭐* · 10");
    expect(resto).toContain("🟡 Vault · *4,60⭐* · 12");
    expect(resto).toContain("⭕ Sibuya");
  });

  it("RESTO: lectura por restaurante contra su objetivo; nunca compara la media agregada", () => {
    expect(blocks).toContain(
      "*Lectura resto:* 0 de 2 restaurantes con actividad están en objetivo; el más crítico es Ribs Zaragoza (3,90⭐). 1 restaurante sin actividad."
    );
    const resto = blocks.slice(blocks.indexOf("📍 *RESTO*"));
    expect(resto).toContain("*4,28⭐ · 22 reseñas*"); // media agregada + reseñas
    expect(resto).not.toContain("frente a");
    expect(resto).not.toContain("objetivo (");
  });

  it("RESTO con el mismo objetivo en todas sus marcas tampoco compara la media agregada; incluye negativas nuevas", () => {
    const snapshot = fixtureSnapshot(TUESDAY, [
      { id: 1, brand: "Ribs", name: "Ribs Zaragoza", average: 4.6, reviews: 10, previous: { average: 4.6, reviews: 9 } },
      {
        id: 2, brand: "Sibuya", name: "Sibuya", average: 4.2, reviews: 8, negative: 1, previous: { average: 4.3, reviews: 7 },
        newNegatives: [{ stars: 2, reason: null, excerpt: null, at: "2026-10-13T08:00:00" }],
      },
      { id: 3, brand: "Vault", name: "Vault", target: 4.4 },
    ]);
    const out = renderDailyReport(snapshot).slice(2, -1).join("\n\n");
    expect(out).toContain(
      "*Lectura resto:* 1 de 2 restaurantes con actividad está en objetivo; el más crítico es Sibuya (4,20⭐). Entra 1 nueva negativa; 1 restaurante sin actividad."
    );
    expect(out).not.toContain("frente a");
  });

  it("lectura corta por marca basada en las cifras (cumplimiento, evolución, negativas, más crítico)", () => {
    expect(all).toContain(
      "*Lectura BK:* BK no llega al objetivo (4,37⭐ frente a 4,40⭐), empeora 0,05 desde ayer. Entra 1 nueva negativa; el más crítico es BK Soria (3,70⭐)."
    );
    expect(all).toContain("*Lectura Tim Hortons:* Tim Hortons cumple el objetivo (4,50⭐ frente a 4,40⭐). Todos los restaurantes están en objetivo.");
  });
});

describe("lectura operativa y cierre", () => {
  const messages = renderDailyReport(weekToDate);
  const last = messages.at(-1)!;

  it("de 3 a 5 hechos relevantes numerados", () => {
    const facts = last.split("\n").filter((line) => /^\*\d\. /.test(line));
    expect(facts).toEqual([
      "*1. Media global:* 4,39⭐ con 117 reseñas.",
      "*2. Alerta del día:* 2 nuevas negativas desde ayer.",
      "*3. BK Soria es el foco principal:* 3,70⭐ con 10 reseñas.",
      "*4. Cerca del objetivo:* Popeyes Andorra queda a 2 positivas (4,35⭐).",
      "*5. Cobertura:* 3 restaurantes sin actividad de 15.",
    ]);
  });

  it("no rellena: con pocos hechos hay pocos puntos", () => {
    const quiet = fixtureSnapshot(TUESDAY, [{ id: 1, brand: "Popeyes", name: "Popeyes Centro", average: 4.8, reviews: 10, previous: { average: 4.8, reviews: 9 } }]);
    const facts = renderDailyReport(quiet).at(-1)!.split("\n").filter((line) => /^\*\d\. /.test(line));
    expect(facts).toEqual(["*1. Media sólida:* 4,80⭐ con 10 reseñas."]);
  });

  it("cierre Nexo con frase operativa", () => {
    expect(last).toContain(`${SEP}\n💜 *NEXO ORIGEN*\n${SEP}`);
    expect(last).toContain("*La reputación se protege actuando sobre los problemas repetidos antes de que se conviertan en la imagen del restaurante.*");
  });
});

describe("0 reseñas, permisos y formato", () => {
  it("0 reseñas es un resultado válido: ceros, guion en la media y sin evolución inventada", () => {
    const empty = fixtureSnapshot(TUESDAY, [
      { id: 1, brand: "Burger King", name: "Burger King A" },
      { id: 2, brand: "Burger King", name: "Burger King B" },
    ]);
    const out = text(empty);
    expect(out).toContain("📊 Reseñas: *0*");
    expect(out).toContain("⭐ Media global: *—*");
    expect(out).toContain("⭕ 2 restaurantes sin reseñas");
    expect(out).toContain("Sin reseñas en el periodo");
    expect(out).toContain("⭕ BK A");
  });

  it("permisos vigentes: oculta los retirados y recalcula con las cifras del snapshot", () => {
    const allowed = new Set([1, 2, 3, 4, 5, 6, 7]); // solo Burger King
    const out = renderDailyReport(weekToDate, { allowedRestaurantIds: allowed });
    const joined = out.join("\n\n");
    expect(out[0]).toContain("📊 Reseñas: *35*");
    expect(out[0]).toContain("⭐ Media global: *4,37*");
    expect(joined).not.toContain("POPEYES");
    expect(joined).not.toContain("Vault");
    expect(joined).toContain("ya no están asignados");
    // El objetivo mostrado sale solo de lo visible: sin Vault ya no hay excepción.
    expect(out[0]).not.toContain("Vault");
  });

  it("empresa y marcas salen de lo visible para cualquier contacto (un restaurante, una marca, varias)", () => {
    const one = buildBriefing(weekToDate, { allowedRestaurantIds: new Set([12]) });
    expect(one.brands.map((b) => b.label)).toEqual(["TIM HORTONS"]);
    expect(one.companies).toEqual(["Grupo Demo"]);
    expect(buildBriefing(weekToDate, { allowedRestaurantIds: new Set<number>() }).restaurants).toEqual([]);
  });

  it("formato WhatsApp: *negrita* simple, sin Markdown, y los datos no rompen el formato", () => {
    const tricky = fixtureSnapshot(TUESDAY, [
      {
        id: 1, brand: "Burger *King*", name: "Burger *King* Sor_ia", average: 3.5, reviews: 10, negative: 2,
        newNegatives: [{ stars: 1, reason: "Mal *servicio*", excerpt: "texto _raro_ ~tachado~ `código`", at: "2026-10-13T08:00:00" }],
        previous: { average: 4, reviews: 9 },
      },
    ]);
    const out = text(tricky);
    expect(out).not.toMatch(/\*\*|^#|\]\(|~|`/m);
    expect(out).not.toContain("Sor_ia");
    expect(out).toContain("Sor ia".replace(" ", ""));
  });
});

describe("división en mensajes", () => {
  it("bloques naturales: 1 cabecera+resumen, 2 prioridades, marcas, último lectura operativa + cierre", () => {
    const messages = renderDailyReport(weekToDate);
    expect(messages[0]).toContain("📊 *INFORME DIARIO*");
    expect(messages[0]).toContain("📌 *RESUMEN EJECUTIVO*");
    expect(messages[0]).not.toContain("PRIORIDADES");
    expect(messages[1]!.startsWith(`${SEP}\n🚨 *PRIORIDADES*`)).toBe(true);
    expect(messages[2]).toContain("🍔 *BURGER KING*");
    expect(messages.at(-1)).toContain("🎯 *LECTURA OPERATIVA*");
    expect(messages.at(-1)).toContain("💜 *NEXO ORIGEN*");
    for (const message of messages) expect(Array.from(message).length).toBeLessThanOrEqual(REPORT_MESSAGE_LIMIT);
  });

  const many: FixtureRestaurant[] = Array.from({ length: 160 }, (_, index) => ({
    id: index + 1,
    brand: index % 2 === 0 ? "Burger King" : "Popeyes",
    name: `${index % 2 === 0 ? "Burger King" : "Popeyes"} Restaurante número ${index + 1}`,
    average: 3.5 + (index % 15) * 0.1,
    reviews: 5 + (index % 9),
    negative: index % 3 === 0 ? 1 : 0,
    previous: { average: 4, reviews: 4 },
  }));
  const big = fixtureSnapshot(TUESDAY, many);

  it("un informe enorme se reparte en varios mensajes en orden, sin superar el límite", () => {
    const messages = renderDailyReport(big);
    expect(messages.length).toBeGreaterThan(4);
    for (const message of messages) expect(Array.from(message).length).toBeLessThanOrEqual(REPORT_MESSAGE_LIMIT);
    expect(messages[0]).toContain("INFORME DIARIO");
    expect(messages.at(-1)).toContain("NEXO ORIGEN");
    // Orden: cabecera → prioridades → marcas → lectura operativa.
    const joined = messages.join("\n\n");
    expect(joined.indexOf("RESUMEN EJECUTIVO")).toBeLessThan(joined.indexOf("PRIORIDADES"));
    expect(joined.indexOf("PRIORIDADES")).toBeLessThan(joined.indexOf("🍔 *BURGER KING*"));
    expect(joined.indexOf("🍔 *BURGER KING*")).toBeLessThan(joined.indexOf("LECTURA OPERATIVA"));
  });

  it("no trunca ni pierde ningún restaurante y nunca corta una línea", () => {
    const messages = renderDailyReport(big);
    const joined = messages.join("\n");
    for (let id = 1; id <= 160; id++) {
      const brand = (id - 1) % 2 === 0 ? "BK" : "Popeyes";
      expect(joined).toContain(`${brand} Restaurante número ${id} · *`);
    }
    // Todas las líneas del informe lineal aparecen enteras (las cabeceras de continuación son añadidas).
    const lines = renderDailyReportLines(big).filter((line) => line !== "");
    const out = new Set(joined.split("\n"));
    for (const line of lines) expect(out.has(line)).toBe(true);
  });

  it("los bloques de marca divididos llevan cabecera de continuación", () => {
    const messages = renderDailyReport(big);
    expect(messages.some((message) => message.includes("(continuación)"))).toBe(true);
  });
});
