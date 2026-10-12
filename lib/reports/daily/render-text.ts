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

const average = (r: SnapshotRestaurant) => (r.reviews > 0 ? r.ratingSum / r.reviews : null);

const normalizeBrand = (brand: string) => brand.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Orden preferente de marcas; el resto va después, alfabéticamente. */
const PREFERRED_BRANDS: { key: string; icon: string; label: string }[] = [
  { key: "burger king", icon: "🍔", label: "BURGER KING" },
  { key: "popeyes", icon: "🍗", label: "POPEYES" },
  { key: "tim hortons", icon: "☕", label: "TIM HORTONS" },
  { key: "santa gloria", icon: "🥐", label: "SANTA GLORIA" },
];

type BrandGroup = { rank: number; sortKey: string; icon: string; label: string; restaurants: SnapshotRestaurant[] };

/** Cada restaurante aparece una sola vez, en el grupo de su marca. */
function groupByBrand(restaurants: SnapshotRestaurant[]): BrandGroup[] {
  const groups = new Map<string, BrandGroup>();
  for (const restaurant of restaurants) {
    const key = normalizeBrand(restaurant.brand ?? "");
    const preferredIndex = PREFERRED_BRANDS.findIndex((brand) => brand.key === key);
    const groupKey = preferredIndex >= 0 ? PREFERRED_BRANDS[preferredIndex]!.key : key || "(otras)";
    let group = groups.get(groupKey);
    if (!group) {
      const preferred = preferredIndex >= 0 ? PREFERRED_BRANDS[preferredIndex]! : null;
      group = {
        rank: preferredIndex >= 0 ? preferredIndex : PREFERRED_BRANDS.length,
        sortKey: groupKey,
        icon: preferred?.icon ?? "🏪",
        label: preferred?.label ?? ((restaurant.brand ?? "").trim().toUpperCase() || "OTROS"),
        restaurants: [],
      };
      groups.set(groupKey, group);
    }
    group.restaurants.push(restaurant);
  }
  return [...groups.values()].sort((a, b) => a.rank - b.rank || a.sortKey.localeCompare(b.sortKey, "es"));
}

const byName = (a: SnapshotRestaurant, b: SnapshotRestaurant) => a.name.localeCompare(b.name, "es");

/** Líneas de una marca: fuera de objetivo (peor primero), en objetivo (mejor primero) y, al final, sin reseñas. */
function brandLines(group: BrandGroup): string[] {
  const withReviews = group.restaurants.filter((restaurant) => restaurant.reviews > 0);
  const off = withReviews
    .filter((restaurant) => restaurantStatus(restaurant) !== "green")
    .sort((a, b) => average(a)! - average(b)! || byName(a, b));
  const on = withReviews
    .filter((restaurant) => restaurantStatus(restaurant) === "green")
    .sort((a, b) => average(b)! - average(a)! || byName(a, b));
  const empty = group.restaurants.filter((restaurant) => restaurant.reviews === 0).sort(byName);

  const lines = [`${group.icon} ${group.label}`];
  if (off.length > 0) lines.push("", "🚨 Fuera de objetivo", ...off.map(restaurantLine));
  if (on.length > 0) {
    lines.push("", off.length === 0 && empty.length === 0 ? "✅ Todos los restaurantes están en objetivo" : "✅ En objetivo", ...on.map(restaurantLine));
  }
  if (empty.length > 0) lines.push("", "📭 Sin reseñas en el periodo", ...empty.map(restaurantLine));
  return lines;
}

function priorities(restaurants: SnapshotRestaurant[]): string[] {
  const brandRank = new Map<number, number>();
  groupByBrand(restaurants).forEach((group, index) => group.restaurants.forEach((restaurant) => brandRank.set(restaurant.id, index)));

  const flagged = restaurants
    .filter((restaurant) => restaurant.negative > 0 || restaurantStatus(restaurant) === "red")
    .sort(
      (a, b) =>
        brandRank.get(a.id)! - brandRank.get(b.id)! ||
        b.negative - a.negative ||
        (average(a) ?? Infinity) - (average(b) ?? Infinity) ||
        byName(a, b)
    );

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

  const lines = [
    ...headerLines(snapshot),
    "",
    `⭐ Media global: ${formatAverage(totals.reviews, totals.ratingSum)}`,
    `💬 Reseñas: ${totals.reviews}`,
    `✅ Positivas: ${totals.positive}`,
    `➖ Neutras: ${totals.neutral}`,
    `🚨 Negativas: ${totals.negative}`,
    "",
    ...groupByBrand(restaurants).flatMap((group, index) => (index === 0 ? brandLines(group) : ["", ...brandLines(group)])),
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
