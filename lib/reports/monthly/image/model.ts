import type { MonthlyReportData } from "../data";
import { resolveMonthlyImageTheme, type MonthlyImageTheme } from "./themes";

/**
 * Datos ya preparados para pintar el informe mensual en imagen.
 *
 * Todas las cifras salen de las mismas métricas oficiales (Supabase) que usa el
 * PDF mensual; aquí solo se derivan agregados de presentación (porcentajes,
 * semanas en objetivo, estado). La plantilla visual no calcula nada.
 */

export type MonthlyImageStatus = "positive" | "watch" | "critical" | "empty";

export type MonthlyImageWeek = {
  index: number;
  label: string;
  /** Reseñas de 5 a 1 estrellas. */
  ratings: [number, number, number, number, number];
  total: number;
  /** null = semana sin actividad (nunca se muestra como 0.00). */
  average: number | null;
  /** Estado frente al objetivo, solo si hay reseñas. */
  onTarget: boolean | null;
};

export type MonthlyImageModel = {
  theme: MonthlyImageTheme;
  restaurantTitle: string;
  /** Localidad sin el nombre de la marca ("PAS DE LA CASA"). */
  locality: string;
  /** Ciudad registrada del restaurante (puede coincidir con la localidad). */
  city: string;
  monthName: string;
  year: number;
  monthLower: string;
  generatedDate: string;
  objective: number;
  average: number | null;
  total: number;
  /** Reseñas de 5 a 1 estrellas. */
  ratings: [number, number, number, number, number];
  positive: number;
  positivePct: number;
  /** Reseñas 1-3★ (las que quedan fuera de 4-5★). */
  belowPositive: number;
  /** Hasta cuántas estrellas es crítica una reseña (Santa Gloria 3, resto 2). */
  criticalMaxStars: 2 | 3;
  critical: number;
  reasons: { name: string; count: number; percent: number }[];
  /** Motivos con causa real (sin "Sin motivo", "Otros"…): el % se reparte solo entre ellos. */
  causalReasons: { name: string; count: number; percent: number }[];
  /** Críticas sin causa identificable, excluidas del reparto de motivos. */
  unclassifiedCritical: number;
  /** Incidencias con causa asignada (suma de todos los motivos con causa); puede ser menor que `critical`. */
  classifiedIncidents: number;
  weeks: MonthlyImageWeek[];
  weeksOnTarget: number;
  weeksBelowTarget: number;
  weeksWithoutActivity: number;
  status: MonthlyImageStatus;
  statusTitle: string;
};

const normalize = (value: string) =>
  value.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Hasta 0,40 por debajo del objetivo se considera "vigilancia"; por debajo de eso, crítico. */
const WATCH_MARGIN = 0.4;

/** "BK ZIZUR MAYOR" / "Burger King Zizur" -> "BURGER KING ZIZUR MAYOR". */
function restaurantTitle(brandDisplay: string, name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  // Si el nombre del local ya incluye la marca ("Taberna del Volapié"), no se repite delante.
  const distinctive = normalize(brandDisplay).split(" ").pop() ?? "";
  if (distinctive.length >= 5 && normalize(cleaned).includes(distinctive)) return cleaned.toUpperCase();
  const strip = new RegExp(`^(${brandDisplay}|bk|pp|sg|th|tv|rb|sb)\\s+`, "i");
  const locality = cleaned.replace(strip, "").trim();
  return `${brandDisplay} ${locality || cleaned}`.toUpperCase();
}

function formatGeneratedDate(now: Date): string {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now).split("-").map(Number);
  return `${String(day).padStart(2, "0")} de ${MONTHS[month - 1]} de ${year}`;
}

function weekLabel(startKey: string, endKey: string): string {
  const month = MONTHS[Number(endKey.slice(5, 7)) - 1].toUpperCase();
  return `${startKey.slice(8)} – ${endKey.slice(8)} ${month}`;
}

function assertValidModel(model: MonthlyImageModel): void {
  const numbers = [model.total, model.objective, ...model.ratings, ...model.weeks.flatMap((w) => [w.total, ...w.ratings])];
  if (numbers.some((v) => !Number.isFinite(v) || v < 0)) throw new Error("Datos del informe no válidos (valores negativos o no numéricos)");
  if (model.average !== null && (model.average < 1 || model.average > 5)) throw new Error("Media mensual fuera de rango");
  const weeksTotal = model.weeks.reduce((sum, w) => sum + w.total, 0);
  if (weeksTotal !== model.total) throw new Error("Las semanas no suman el total de reseñas del mes");
}

export function buildMonthlyImageModel(data: MonthlyReportData, now: Date = new Date()): MonthlyImageModel {
  const theme = resolveMonthlyImageTheme(data.restaurant.brand);
  const objective = data.restaurant.target;
  const c = data.current;
  const stars = [c.stars_5, c.stars_4, c.stars_3, c.stars_2, c.stars_1].map((v) => Number(v) || 0) as MonthlyImageModel["ratings"];
  const total = stars.reduce((sum, v) => sum + v, 0);
  const average = total ? Number(c.media_exacta) : null;
  const positive = stars[0] + stars[1];
  const criticalMaxStars = data.criticalMaxStars;
  const critical = stars[3] + stars[4] + (criticalMaxStars === 3 ? stars[2] : 0);
  const reasonsTotal = data.criticalReasons.reduce((sum, r) => sum + r.count, 0) || critical;
  const causal = data.criticalReasons.filter((r) => r.causal);
  const causalTotal = causal.reduce((sum, r) => sum + r.count, 0);

  const weeks: MonthlyImageWeek[] = data.weeks.map((week, index) => {
    const ratings = [week.stars[4], week.stars[3], week.stars[2], week.stars[1], week.stars[0]] as MonthlyImageWeek["ratings"];
    const weekTotal = ratings.reduce((sum, v) => sum + v, 0);
    return {
      index: index + 1,
      label: weekLabel(week.startKey, week.endKey),
      ratings,
      total: weekTotal,
      average: weekTotal ? week.average : null,
      onTarget: weekTotal && week.average !== null ? week.average >= objective : null,
    };
  });
  const weeksOnTarget = weeks.filter((w) => w.onTarget === true).length;
  const weeksBelowTarget = weeks.filter((w) => w.onTarget === false).length;
  const weeksWithoutActivity = weeks.filter((w) => w.total === 0).length;

  const status: MonthlyImageStatus = average === null
    ? "empty"
    : average >= objective ? "positive"
    : average >= objective - WATCH_MARGIN ? "watch" : "critical";
  const positivePct = total ? positive / total * 100 : 0;
  const statusTitle = status === "empty" ? "Sin reseñas este mes."
    : status === "positive" ? "Mes por encima del objetivo." : "Mes por debajo del objetivo.";

  const monthIndex = Number(data.startKey.slice(5, 7)) - 1;
  const model: MonthlyImageModel = {
    theme,
    restaurantTitle: restaurantTitle(theme.displayName, data.restaurant.name),
    locality: restaurantTitle(theme.displayName, data.restaurant.name).replace(new RegExp(`^${theme.displayName.toUpperCase()}\\s+`), ""),
    city: data.restaurant.city.trim().toUpperCase(),
    monthName: MONTHS[monthIndex].toUpperCase(),
    monthLower: MONTHS[monthIndex],
    year: Number(data.startKey.slice(0, 4)),
    generatedDate: formatGeneratedDate(now),
    objective,
    average,
    total,
    ratings: stars,
    positive,
    positivePct,
    belowPositive: total - positive,
    criticalMaxStars,
    critical,
    reasons: data.criticalReasons.slice(0, 3).map((r) => ({ name: r.label, count: r.count, percent: reasonsTotal ? (r.count / reasonsTotal) * 100 : 0 })),
    causalReasons: causal.slice(0, 3).map((r) => ({ name: r.label, count: r.count, percent: causalTotal ? (r.count / causalTotal) * 100 : 0 })),
    classifiedIncidents: causalTotal,
    unclassifiedCritical: data.criticalReasons.filter((r) => !r.causal).reduce((sum, r) => sum + r.count, 0),
    weeks,
    weeksOnTarget,
    weeksBelowTarget,
    weeksWithoutActivity,
    status,
    statusTitle,
  };
  assertValidModel(model);
  return model;
}
