import { addCalendarDays, formatDay, formatDayRange } from "./calendar";
import {
  buildBriefing,
  MAX_NEW_NEGATIVES_SHOWN,
  plainText,
  type Briefing,
  type BrandBlock,
  type DerivedRestaurant,
} from "./briefing";
import type { DailyReportSnapshot } from "./snapshot";

/**
 * Texto de WhatsApp del informe diario: briefing operativo. Se renderiza SIEMPRE desde el snapshot (ver
 * `briefing.ts`): no consulta reseñas ni recalcula nada. Solo formato compatible con WhatsApp (*negrita*,
 * _cursiva_, emojis); los datos dinámicos se limpian de `* _ ~` para que no rompan el formato.
 *
 * Es largo: se divide por bloques naturales (cabecera + resumen, prioridades, marcas, lectura operativa +
 * cierre) y, si un bloque no cabe, siempre por líneas completas. Nunca se trunca ni se corta una línea.
 */

/** Margen sobre los 4096 caracteres de WhatsApp (emojis y saltos cuentan como varios en algunos clientes). */
export const REPORT_MESSAGE_LIMIT = 3500;
/** Las marcas se agrupan en un mismo mensaje mientras no pasen de este tamaño. */
const BRAND_PACK_LIMIT = 3000;

const SEPARATOR = "━━━━━━━━━━━━━━";
const CLOSING_PHRASE =
  "La reputación se protege actuando sobre los problemas repetidos antes de que se conviertan en la imagen del restaurante.";
const DISCLAIMER = "_Las incidencias reflejan opiniones de clientes y deben verificarse internamente._";

const STATUS_ICON = { green: "🟢", yellow: "🟡", red: "🔴", none: "⭕" } as const;

const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (value: number) => decimal.format(value);
const fmtAverage = (value: number | null) => (value === null ? "—" : fmt(value));
const signed = (value: number, formatter: (n: number) => string) =>
  value > 0 ? `+${formatter(value)}` : value < 0 ? `-${formatter(Math.abs(value))}` : "sin cambios";
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const trimTo = (text: string, max: number) => {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
};

export type RenderOptions = {
  /**
   * Si se indica, solo se muestran estos restaurantes (permiso vigente en el momento de pulsar). Los totales,
   * las marcas y las prioridades se recalculan con las cifras del propio snapshot de los que quedan.
   */
  allowedRestaurantIds?: ReadonlySet<number>;
};

// Cabecera y resumen ejecutivo --------------------------------------------------------------------------

function headerBlock(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const closure = snapshot.kind === "WEEKLY_CLOSURE";
  const monday = snapshot.period.firstDay;
  const sunday = addCalendarDays(monday, 6);
  const lines = [
    SEPARATOR,
    closure ? "✅ *CIERRE SEMANAL*" : "📊 *INFORME DIARIO*",
    `📅 ${formatDay(snapshot.slotDate, true)}`,
    // Siempre la semana natural completa, aunque en curso solo tenga datos hasta las 09:00.
    `📆 ${closure ? "Periodo cerrado" : "Periodo"}: *${formatDayRange(monday, sunday)}*`,
  ];
  if (briefing.companies.length > 0) lines.push(`🏤 ${briefing.companies.join(" · ")}`);
  lines.push(SEPARATOR);
  return lines;
}

function legendBlock(briefing: Briefing): string[] {
  // Cada restaurante se evalúa contra el objetivo de su marca: con objetivos distintos no hay un único
  // umbral que mostrar, así que se listan los objetivos por marca.
  const targets =
    briefing.uniformTarget !== null
      ? [`🎯 *Objetivo: ${fmt(briefing.uniformTarget)}⭐*`]
      : ["🎯 *Objetivos*", briefing.brandTargets.map((item) => `${item.brand}: *${fmt(item.target)}⭐*`).join(" · ")];
  return [
    ...targets,
    "🔴 Crítico · 🟡 En vigilancia · 🟢 En objetivo",
    "⚠️ Poco volumen: entre 1 y 6 reseñas",
    "⭕ Sin actividad: 0 reseñas",
  ];
}

const sinceText = (kind: DailyReportSnapshot["kind"]) => (kind === "WEEKLY_CLOSURE" ? "el domingo a las 09:00" : "ayer");

function evolutionBlock(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const comparison = briefing.comparison;
  if (!comparison) return [];
  const now = briefing.totals;
  const before = comparison.previousTotals;
  const averageNow = briefing.average;
  const averagePrevious = comparison.previousAverage;

  const averageDiff =
    averageNow !== null && averagePrevious !== null ? ` (${signed(averageNow - averagePrevious, fmt)})` : "";

  return [
    snapshot.kind === "WEEKLY_CLOSURE" ? "*Evolución frente al domingo (09:00)*" : "*Evolución desde ayer*",
    `⭐ ${fmtAverage(averagePrevious)} → *${fmtAverage(averageNow)}${averageDiff}*`,
    `📊 ${before.reviews} → *${now.reviews} (${signed(now.reviews - before.reviews, String)})*`,
    `🔴 ${before.negative} → *${now.negative} negativas (${signed(now.negative - before.negative, String)})*`,
  ];
}

/** Lectura ejecutiva breve y determinista: solo cifras del snapshot, máximo dos frases. */
function executiveReading(snapshot: DailyReportSnapshot, briefing: Briefing): string {
  if (briefing.totals.reviews === 0 || briefing.average === null) {
    return "Sin reseñas en el periodo: no hay actividad que valorar todavía.";
  }
  const average = briefing.average;
  const target = briefing.uniformTarget;
  const when = sinceText(snapshot.kind);
  const comparison = briefing.comparison;

  const averageDiff = comparison && comparison.previousAverage !== null ? average - comparison.previousAverage : null;
  const trend =
    averageDiff !== null && Math.abs(averageDiff) >= 0.005
      ? `, y ${averageDiff > 0 ? "sube" : "baja"} ${fmt(Math.abs(averageDiff))} desde ${when}`
      : "";
  // Con objetivos distintos por marca, la media global no se compara contra un único objetivo.
  const first =
    target === null
      ? `La media global es ${fmt(average)}⭐${trend}.`
      : average >= target
        ? `La media global (${fmt(average)}⭐) cumple el objetivo de ${fmt(target)}⭐${trend}.`
        : `La media global (${fmt(average)}⭐) está por debajo del objetivo de ${fmt(target)}⭐${trend}.`;

  const active = briefing.restaurants.length - briefing.counts.inactive;
  const negativesDiff = comparison ? briefing.totals.negative - comparison.previousTotals.negative : 0;
  const coverageDiff = comparison ? active - comparison.previousActive : 0;

  let second: string;
  if (negativesDiff > 0 || briefing.newNegativeCount > 0) {
    const count = negativesDiff > 0 ? negativesDiff : briefing.newNegativeCount;
    second = `El dato a vigilar es el aumento de negativas: ${plural(count, "nueva", "nuevas")} desde ${when}.`;
  } else if (coverageDiff > 0) {
    second = `La cobertura mejora: ya tienen actividad ${active} de ${briefing.restaurants.length} restaurantes.`;
  } else if (briefing.counts.offTarget > 0) {
    second = `${plural(briefing.counts.offTarget, "restaurante está", "restaurantes están")} fuera de objetivo.`;
  } else {
    second = "Todos los restaurantes con actividad están en objetivo.";
  }
  return `${first} ${second}`;
}

function summaryBlock(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const { totals, counts } = briefing;
  const lines = [
    SEPARATOR,
    "📌 *RESUMEN EJECUTIVO*",
    SEPARATOR,
    `⭐ Media global: *${fmtAverage(briefing.average)}*`,
    `📊 Reseñas: *${totals.reviews}*`,
    `✅ ${totals.positive} positivas · ➖ ${totals.neutral} neutras · 🔴 ${totals.negative} negativas`,
    "",
    `🟢 ${plural(counts.onTarget, "restaurante", "restaurantes")} en objetivo`,
    `🔴🟡 ${plural(counts.offTarget, "restaurante", "restaurantes")} fuera de objetivo`,
    `⭕ ${plural(counts.inactive, "restaurante", "restaurantes")} sin reseñas`,
  ];
  const evolution = evolutionBlock(snapshot, briefing);
  if (evolution.length > 0) lines.push("", ...evolution);
  lines.push("", executiveReading(snapshot, briefing));
  return lines;
}

// Prioridades -------------------------------------------------------------------------------------------

function priorityLines(restaurant: DerivedRestaurant, index: number, kind: DailyReportSnapshot["kind"]): string[] {
  const icon = STATUS_ICON[restaurant.status];
  const lines = [`${icon} *${restaurant.displayName} · ${fmtAverage(restaurant.average)}⭐*`];

  const facts = [`${plural(restaurant.reviews, "reseña", "reseñas")}${restaurant.lowVolume ? " ⚠️" : ""}`];
  if (restaurant.negative > 0) facts.push(plural(restaurant.negative, "negativa", "negativas"));
  if (restaurant.positivesNeeded !== null && restaurant.positivesNeeded > 0) {
    facts.push(`+${restaurant.positivesNeeded} ${restaurant.positivesNeeded === 1 ? "positiva" : "positivas"}`);
  }
  lines.push(facts.join(" · "));

  const offTarget = restaurant.status === "red" || restaurant.status === "yellow";
  if (index === 0 && offTarget && restaurant.negative > 0) {
    lines.push(`🚨 Principal foco: ${plural(restaurant.negative, "negativa", "negativas")} en ${plural(restaurant.reviews, "reseña", "reseñas")}.`);
  }

  const news = restaurant.newNegativeCount;
  const since = kind === "WEEKLY_CLOSURE" ? "el domingo" : "ayer";

  if (restaurant.deteriorated && restaurant.previousAverage !== null) {
    const cause = news > 0 ? ` tras ${plural(news, "nueva negativa", "nuevas negativas")}` : ` respecto a ${since}`;
    lines.push(`📉 Baja desde ${fmt(restaurant.previousAverage)}⭐${cause}.`);
  }

  const shown = restaurant.newNegatives.slice(0, MAX_NEW_NEGATIVES_SHOWN);
  for (const negative of shown) {
    const reason = negative.reason ? plainText(negative.reason) : "sin motivo identificado";
    const excerpt = negative.excerpt ? ` · _“${trimTo(plainText(negative.excerpt), 90)}”_` : "";
    lines.push(`🆕 Nueva ${negative.stars}⭐ · ${reason}${excerpt}`);
  }
  const more = news - shown.length;
  if (more > 0) lines.push(`🆕 y ${plural(more, "negativa nueva más", "negativas nuevas más")}.`);
  return lines;
}

function prioritiesBlock(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const lines = [SEPARATOR, "🚨 *PRIORIDADES*", SEPARATOR];
  if (briefing.priorities.length === 0) {
    lines.push("✅ Sin restaurantes fuera de objetivo con negativas ni negativas nuevas en este periodo.");
    return lines;
  }
  lines.push("_«+N positivas» = reseñas de 5⭐ nuevas necesarias para llegar al objetivo._", "");
  briefing.priorities.forEach((restaurant, index) => {
    if (index > 0) lines.push("");
    lines.push(...priorityLines(restaurant, index, snapshot.kind));
  });
  if (briefing.prioritiesOmitted > 0) {
    lines.push("", `➕ Y ${plural(briefing.prioritiesOmitted, "restaurante prioritario más", "restaurantes prioritarios más")}: míralos en su marca.`);
  }
  lines.push("", DISCLAIMER);
  return lines;
}

// Marcas ------------------------------------------------------------------------------------------------

function restaurantLine(restaurant: DerivedRestaurant): string {
  const warn = restaurant.lowVolume ? " ⚠️" : "";
  return `${STATUS_ICON[restaurant.status]} ${restaurant.displayName} · *${fmtAverage(restaurant.average)}⭐* · ${restaurant.reviews}${warn}`;
}

function brandReading(block: BrandBlock, kind: DailyReportSnapshot["kind"]): string {
  const when = sinceText(kind);
  const name = block.short;
  const active = block.restaurants.length - block.inactive.length;

  if (block.average === null) return `*Lectura ${name}:* sin reseñas en el periodo.`;

  // RESTO mezcla marcas con objetivos distintos: nunca se compara su media agregada contra un objetivo;
  // se evalúa cada restaurante contra el suyo.
  const critical = block.off[0];
  const criticalText = critical ? `el más crítico es ${critical.displayName} (${fmt(critical.average!)}⭐)` : null;
  const entra =
    block.newNegativeCount === 1
      ? "Entra 1 nueva negativa"
      : `Entran ${block.newNegativeCount} nuevas negativas`;

  if (block.isResto || block.target === null) {
    if (active === 0) return `*Lectura ${name}:* sin reseñas en el periodo.`;
    const firstResto = `${block.on.length} de ${active} restaurantes con actividad ${block.on.length === 1 ? "está" : "están"} en objetivo${
      criticalText ? `; ${criticalText}` : ""
    }.`;
    const extra: string[] = [];
    if (block.newNegativeCount > 0) extra.push(entra);
    if (block.inactive.length > 0) extra.push(`${plural(block.inactive.length, "restaurante", "restaurantes")} sin actividad`);
    return `*Lectura ${name}:* ${firstResto}${extra.length > 0 ? ` ${extra.join("; ")}.` : ""}`;
  }

  const verb = block.average >= block.target ? "cumple el objetivo" : "no llega al objetivo";
  const diff = block.previousAverage !== null ? block.average - block.previousAverage : null;
  const trend =
    diff !== null && Math.abs(diff) >= 0.005 ? `, ${diff > 0 ? "mejora" : "empeora"} ${fmt(Math.abs(diff))} desde ${when}` : "";
  const first = `${name} ${verb} (${fmt(block.average)}⭐ frente a ${fmt(block.target)}⭐)${trend}.`;

  let second: string;
  if (block.newNegativeCount > 0) {
    second = criticalText ? `${entra}; ${criticalText}.` : `${entra}.`;
  } else if (critical) {
    second = `${block.off.length} de ${active} restaurantes con actividad ${block.off.length === 1 ? "está" : "están"} fuera de objetivo; ${criticalText}.`;
  } else if (block.inactive.length > 0) {
    second = `Todos los restaurantes con actividad están en objetivo; ${plural(block.inactive.length, "restaurante", "restaurantes")} sin actividad.`;
  } else {
    second = "Todos los restaurantes están en objetivo.";
  }
  return `*Lectura ${name}:* ${first} ${second}`;
}

function brandBlockLines(block: BrandBlock, kind: DailyReportSnapshot["kind"]): string[] {
  const lines = [
    SEPARATOR,
    `${block.icon} *${block.label}*`,
    block.average === null
      ? "*Sin reseñas en el periodo*"
      : `*${fmt(block.average)}⭐ · ${plural(block.totals.reviews, "reseña", "reseñas")}*`,
    SEPARATOR,
    ...block.off.map(restaurantLine),
    ...block.on.map(restaurantLine),
  ];
  if (block.inactive.length > 0) {
    if (block.off.length + block.on.length > 0) lines.push("");
    lines.push("⭕ *SIN ACTIVIDAD*", ...block.inactive.map((restaurant) => `⭕ ${restaurant.displayName}`));
  }
  lines.push("", brandReading(block, kind));
  return lines;
}

// Lectura operativa y cierre ---------------------------------------------------------------------------

function operativeFacts(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const facts: string[] = [];
  const { totals } = briefing;
  const closure = snapshot.kind === "WEEKLY_CLOSURE";
  const when = sinceText(snapshot.kind);

  if (totals.reviews > 0 && briefing.average !== null) {
    // Con objetivos distintos por marca no hay un único objetivo contra el que valorar la media global.
    const uniform = briefing.uniformTarget;
    const title = uniform === null ? "Media global" : briefing.average >= uniform ? "Media sólida" : "Media por debajo del objetivo";
    facts.push(`*${title}:* ${fmt(briefing.average)}⭐ con ${plural(totals.reviews, "reseña", "reseñas")}.`);
  }

  const comparison = briefing.comparison;
  const negativesDiff = comparison ? totals.negative - comparison.previousTotals.negative : 0;
  if (briefing.newNegativeCount > 0) {
    facts.push(
      `*${closure ? "Alerta de la semana" : "Alerta del día"}:* ${plural(briefing.newNegativeCount, "nueva negativa", "nuevas negativas")} desde ${when}.`
    );
  } else if (negativesDiff > 0) {
    facts.push(`*Más negativas:* ${plural(negativesDiff, "negativa más", "negativas más")} desde ${when}.`);
  }

  const focus = briefing.priorities.find(
    (restaurant) => (restaurant.status === "red" || restaurant.status === "yellow") && restaurant.negative > 0
  );
  if (focus) {
    facts.push(
      `*${focus.displayName} es el foco principal:* ${fmt(focus.average!)}⭐ con ${plural(focus.reviews, "reseña", "reseñas")}${
        focus.lowVolume ? " (poco volumen)" : ""
      }.`
    );
  }

  const near = briefing.restaurants
    .filter((restaurant) => restaurant.positivesNeeded !== null && restaurant.positivesNeeded >= 1 && restaurant.positivesNeeded <= 3)
    .sort(
      (a, b) =>
        a.positivesNeeded! - b.positivesNeeded! || b.average! - a.average! || a.displayName.localeCompare(b.displayName, "es")
    )[0];
  if (near) {
    facts.push(`*Cerca del objetivo:* ${near.displayName} queda a ${plural(near.positivesNeeded!, "positiva", "positivas")} (${fmt(near.average!)}⭐).`);
  }

  if (briefing.counts.inactive > 0) {
    const active = briefing.restaurants.length - briefing.counts.inactive;
    const grew = comparison ? active - comparison.previousActive : 0;
    facts.push(
      grew > 0
        ? `*La cobertura crece:* sólo quedan ${plural(briefing.counts.inactive, "restaurante", "restaurantes")} sin actividad.`
        : `*Cobertura:* ${plural(briefing.counts.inactive, "restaurante", "restaurantes")} sin actividad de ${briefing.restaurants.length}.`
    );
  }
  return facts.slice(0, 5);
}

function operativeBlock(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const facts = operativeFacts(snapshot, briefing);
  const lines = [SEPARATOR, "🎯 *LECTURA OPERATIVA*", SEPARATOR];
  if (facts.length === 0) {
    lines.push("Sin hechos relevantes en este periodo.");
  } else {
    // Numeración sobre el texto: "*Media sólida:*" → "*1. Media sólida:*".
    facts.forEach((fact, index) => lines.push(fact.replace(/^\*/, `*${index + 1}. `)));
  }
  return lines;
}

function closingBlock(snapshot: DailyReportSnapshot, briefing: Briefing): string[] {
  const lines: string[] = [];
  if (briefing.hidden > 0) {
    lines.push("ℹ️ Algunos restaurantes de este informe ya no están asignados a tu cuenta y no se muestran.", "");
  }
  lines.push(SEPARATOR, "💜 *NEXO ORIGEN*", SEPARATOR, `*${CLOSING_PHRASE}*`);
  if (snapshot.kind === "WEEKLY_CLOSURE") lines.push("", "📌 *Semana cerrada.*");
  return lines;
}

// Composición y división en mensajes -------------------------------------------------------------------

type Section = { lines: string[]; kind: "head" | "priorities" | "brand" | "final"; continuation?: string };

function buildSections(snapshot: DailyReportSnapshot, options: RenderOptions): Section[] {
  const briefing = buildBriefing(snapshot, { allowedRestaurantIds: options.allowedRestaurantIds });

  return [
    {
      kind: "head",
      lines: [...headerBlock(snapshot, briefing), ...legendBlock(briefing), "", ...summaryBlock(snapshot, briefing)],
    },
    { kind: "priorities", lines: prioritiesBlock(snapshot, briefing) },
    ...briefing.brands.map(
      (block): Section => ({
        kind: "brand",
        lines: brandBlockLines(block, snapshot.kind),
        continuation: `${block.icon} *${block.label}* _(continuación)_`,
      })
    ),
    { kind: "final", lines: [...operativeBlock(snapshot, briefing), "", ...closingBlock(snapshot, briefing)] },
  ];
}

/** Líneas del informe en el orden final (sin dividir en mensajes); los bloques van separados por una línea en blanco. */
export function renderDailyReportLines(snapshot: DailyReportSnapshot, options: RenderOptions = {}): string[] {
  return buildSections(snapshot, options).flatMap((section, index) => (index === 0 ? section.lines : ["", ...section.lines]));
}

/** Divide por líneas completas en mensajes de hasta `limit` caracteres, en orden. */
export function splitLines(lines: string[], limit: number = REPORT_MESSAGE_LIMIT): string[] {
  const messages: string[] = [];
  let current: string[] = [];
  let size = 0;

  for (const line of lines) {
    const cost = Array.from(line).length + 1;
    if (current.length > 0 && size + cost > limit) {
      messages.push(trimBlank(current).join("\n"));
      current = [];
      size = 0;
    }
    // Un mensaje no empieza por una línea en blanco.
    if (current.length === 0 && line === "") continue;
    current.push(line);
    size += cost;
  }
  if (current.length > 0) messages.push(trimBlank(current).join("\n"));
  return messages.filter((message) => message.trim() !== "");
}

function trimBlank(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

const textSize = (text: string) => Array.from(text).length;

/** Mensajes de WhatsApp del informe, listos para enviar en orden. */
export function renderDailyReport(snapshot: DailyReportSnapshot, options: RenderOptions = {}): string[] {
  const sections = buildSections(snapshot, options);
  const messages: string[] = [];
  let pack: string[] = []; // bloques de marca consecutivos que caben juntos

  const flushPack = () => {
    if (pack.length > 0) messages.push(pack.join("\n\n"));
    pack = [];
  };

  for (const section of sections) {
    if (section.kind !== "brand") {
      flushPack();
      messages.push(...splitLines(section.lines));
      continue;
    }

    const reserve = section.continuation ? textSize(section.continuation) + 2 : 0;
    const pieces = splitLines(section.lines, BRAND_PACK_LIMIT - reserve);

    if (pieces.length > 1) {
      // Un bloque dividido ocupa sus propios mensajes; los siguientes llevan la cabecera de continuación.
      flushPack();
      pieces.forEach((piece, index) => messages.push(index === 0 || !section.continuation ? piece : `${section.continuation}\n${piece}`));
      continue;
    }

    const text = pieces[0]!;
    if (pack.length > 0 && textSize(pack.join("\n\n")) + 2 + textSize(text) > BRAND_PACK_LIMIT) flushPack();
    pack.push(text);
  }
  flushPack();
  return messages.filter((message) => message.trim() !== "");
}
