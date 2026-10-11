import { formatDay, formatDayRange, weekdayName } from "./calendar";
import { restaurantStatus, type DailyReportSnapshot, type RestaurantStatus, type SnapshotRestaurant } from "./snapshot";

/**
 * Texto de WhatsApp del informe diario (V1: solo texto). Se renderiza SIEMPRE desde el snapshot:
 * no consulta reseñas ni recalcula nada. Totales y medias salen de las cifras brutas de cada restaurante.
 *
 * Si el texto no cabe en un mensaje se divide en varios mensajes ordenados, siempre por líneas: un
 * restaurante nunca se trunca ni se corta a medias.
 */

/** Margen sobre los 4096 caracteres de WhatsApp (emojis y saltos cuentan como varios en algunos clientes). */
export const REPORT_MESSAGE_LIMIT = 3500;

const STATUS_ICON: Record<RestaurantStatus, string> = { green: "🟢", yellow: "🟡", red: "🔴", none: "⚪" };

const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatAverage = (reviews: number, ratingSum: number) => (reviews > 0 ? decimal.format(ratingSum / reviews) : "—");
const reviewsText = (count: number) => `${count} ${count === 1 ? "reseña" : "reseñas"}`;
const negativesText = (count: number) => `${count} ${count === 1 ? "negativa" : "negativas"}`;

export type RenderOptions = {
  /**
   * Si se indica, solo se muestran estos restaurantes (permiso vigente en el momento de pulsar). Los totales
   * se recalculan con las cifras del propio snapshot de los que quedan; nada se vuelve a consultar.
   */
  allowedRestaurantIds?: ReadonlySet<number>;
};

function headerLines(snapshot: DailyReportSnapshot): string[] {
  const { firstDay, lastDay } = snapshot.period;
  if (snapshot.kind === "WEEKLY_CLOSURE") {
    return [
      "✅ Nexo Origen · Cierre semanal",
      `📅 Semana del ${formatDayRange(firstDay, lastDay, true)}`,
      "🏁 Resultado FINAL de la semana",
    ];
  }
  return [
    "📊 Nexo Origen · Semana en curso",
    `📅 Del ${formatDayRange(firstDay, lastDay, true)}`,
    `🕘 Actualizado: ${weekdayName(snapshot.slotDate)} ${formatDay(snapshot.slotDate)} · 09:00`,
  ];
}

function restaurantLine(restaurant: SnapshotRestaurant): string {
  const icon = STATUS_ICON[restaurantStatus(restaurant)];
  if (restaurant.reviews === 0) return `${icon} ${restaurant.name} · sin reseñas`;
  return `${icon} ${restaurant.name} · ${formatAverage(restaurant.reviews, restaurant.ratingSum)} · ${reviewsText(restaurant.reviews)}`;
}

function priorities(restaurants: SnapshotRestaurant[]): string[] {
  const flagged = restaurants
    .filter((restaurant) => restaurant.negative > 0 || restaurantStatus(restaurant) === "red")
    .sort((a, b) => b.negative - a.negative || a.name.localeCompare(b.name, "es"));

  if (flagged.length === 0) return ["✅ Sin reseñas negativas ni restaurantes en rojo en este periodo."];

  return flagged.map((restaurant) => {
    const parts = [restaurant.name];
    if (restaurant.negative > 0) parts.push(negativesText(restaurant.negative));
    else parts.push(`media ${formatAverage(restaurant.reviews, restaurant.ratingSum)}`);
    if (restaurant.topReason) parts.push(`motivo principal: ${restaurant.topReason}`);
    return `• ${parts.join(" · ")}`;
  });
}

/** Líneas del informe en el orden final (sin dividir en mensajes). */
export function renderDailyReportLines(snapshot: DailyReportSnapshot, options: RenderOptions = {}): string[] {
  const allowed = options.allowedRestaurantIds;
  const restaurants = allowed ? snapshot.restaurants.filter((restaurant) => allowed.has(restaurant.id)) : snapshot.restaurants;
  const hidden = snapshot.restaurants.length - restaurants.length;

  const totals = restaurants.reduce(
    (sum, restaurant) => ({
      reviews: sum.reviews + restaurant.reviews,
      ratingSum: sum.ratingSum + restaurant.ratingSum,
      positive: sum.positive + restaurant.positive,
      neutral: sum.neutral + restaurant.neutral,
      negative: sum.negative + restaurant.negative,
    }),
    { reviews: 0, ratingSum: 0, positive: 0, neutral: 0, negative: 0 }
  );

  // Más media primero; los que no tienen reseñas, al final.
  const ordered = [...restaurants].sort((a, b) => {
    if ((a.reviews === 0) !== (b.reviews === 0)) return a.reviews === 0 ? 1 : -1;
    const average = (r: SnapshotRestaurant) => (r.reviews > 0 ? r.ratingSum / r.reviews : 0);
    return average(b) - average(a) || b.reviews - a.reviews || a.name.localeCompare(b.name, "es");
  });

  const lines = [
    ...headerLines(snapshot),
    "",
    `⭐ Media global: ${formatAverage(totals.reviews, totals.ratingSum)}`,
    `💬 Reseñas: ${totals.reviews}`,
    `✅ Positivas: ${totals.positive}`,
    `➖ Neutras: ${totals.neutral}`,
    `🚨 Negativas: ${totals.negative}`,
    "",
    "🏪 Restaurantes",
    ...ordered.map(restaurantLine),
    "",
    "🚨 Prioridades",
    ...priorities(restaurants),
  ];

  if (hidden > 0) {
    lines.push("", "ℹ️ Algunos restaurantes de este informe ya no están asignados a tu cuenta y no se muestran.");
  }
  if (snapshot.kind === "WEEKLY_CLOSURE") lines.push("", "📌 Semana cerrada.");
  return lines;
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

/** Mensajes de WhatsApp del informe, listos para enviar en orden. */
export function renderDailyReport(snapshot: DailyReportSnapshot, options: RenderOptions = {}): string[] {
  return splitLines(renderDailyReportLines(snapshot, options));
}
