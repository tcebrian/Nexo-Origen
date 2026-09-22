import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { toDateKey } from "@/lib/dates/period";
import {
  fetchSupabaseCanonicalReputationMetrics,
  type SupabaseMetricRow,
} from "@/lib/supabase/reputation-metrics.server";
import type { AgentDailySummaryPreview } from "@/lib/agents/types";

type AccessRow = {
  id: string;
  nombre: string;
  todos_restaurantes: boolean;
  restaurante_ids: Array<number | string>;
};

type RestaurantRow = {
  id: number;
  nombre: string;
  ciudad: string | null;
  marca_id: number | null;
  empresa_id: number | null;
};

type BrandRow = {
  id: number;
  nombre: string;
  objetivo_media: number;
};

type RestaurantSummaryRow = RestaurantRow & {
  marca: string;
  target: number;
  total: number;
  ratingSum: number;
  media: number;
  positivas: number;
  neutras: number;
  negativas: number;
};

type BrandSummary = {
  marca: string;
  emoji: string;
  title: string;
  shortLabel: string;
  target: number;
  total: number;
  ratingSum: number;
  media: number;
  positivas: number;
  neutras: number;
  negativas: number;
  rows: RestaurantSummaryRow[];
};

const DIVIDER = "━━━━━━━━━━━━━━";
const THIN_DIVIDER = "──────────────";

const BRAND_META: Record<
  string,
  { emoji: string; title: string; shortLabel: string }
> = {
  "Burger King": { emoji: "🍔", title: "𝗕𝗨𝗥𝗚𝗘𝗥 𝗞𝗜𝗡𝗚", shortLabel: "BK" },
  Popeyes: { emoji: "🍗", title: "𝗣𝗢𝗣𝗘𝗬𝗘𝗦", shortLabel: "PLK" },
  "Santa Gloria": { emoji: "☕", title: "𝗦𝗔𝗡𝗧𝗔 𝗚𝗟𝗢𝗥𝗜𝗔", shortLabel: "SG" },
  Ribs: { emoji: "🥩", title: "𝗥𝗜𝗕𝗦", shortLabel: "Ribs" },
  Sibuya: { emoji: "🍣", title: "𝗦𝗜𝗕𝗨𝗬𝗔", shortLabel: "Sibuya" },
  "Tim Hortons": { emoji: "🍩", title: "𝗧𝗜𝗠 𝗛𝗢𝗥𝗧𝗢𝗡𝗦", shortLabel: "TH" },
  "Taberna Volapié": { emoji: "🍻", title: "𝗩𝗢𝗟𝗔𝗣𝗜𝗘́", shortLabel: "Volapié" },
};

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

function metricNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeIds(values: Array<number | string>): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

function addDays(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayOf(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, offset);
}

function dateParts(dateKey: string): { day: number; month: string; year: number } {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = Number(
    new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      timeZone: "Europe/Madrid",
    }).format(date)
  );
  const month = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(date);
  const year = Number(
    new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      timeZone: "Europe/Madrid",
    }).format(date)
  );

  return { day, month, year };
}

function formatReportDate(dateKey: string): string {
  const { day, month, year } = dateParts(dateKey);
  return `${day} de ${month} de ${year}`;
}

function formatWeeklyPeriod(startKey: string, endKey: string): string {
  const start = dateParts(startKey);
  const end = dateParts(endKey);

  if (start.year === end.year && start.month === end.month) {
    return `${start.day} al ${end.day} de ${end.month}`;
  }

  if (start.year === end.year) {
    return `${start.day} de ${start.month} al ${end.day} de ${end.month}`;
  }

  return `${start.day} de ${start.month} de ${start.year} al ${end.day} de ${end.month} de ${end.year}`;
}

function formatMedia(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function pluralResena(value: number): string {
  return value === 1 ? "1 reseña" : `${value} reseñas`;
}

function statusFor(media: number, total: number, target: number) {
  if (total === 0) return "empty" as const;
  if (media >= target) return "green" as const;
  if (media >= 4.0) return "yellow" as const;
  return "red" as const;
}

function positiveReviewsNeeded(
  ratingSum: number,
  total: number,
  target: number
): number {
  if (total <= 0 || target >= 5) return 0;
  const raw = (target * total - ratingSum) / (5 - target);
  return Math.max(0, Math.ceil(raw - 1e-10));
}

function brandMeta(marca: string) {
  return (
    BRAND_META[marca] ?? {
      emoji: "🏪",
      title: marca.toUpperCase(),
      shortLabel: marca,
    }
  );
}

function displayRestaurantName(row: RestaurantSummaryRow): string {
  const name = row.nombre.trim();

  if (row.marca === "Popeyes") {
    return name.replace(/^Popeyes\s+/i, "PLK ");
  }
  if (row.marca === "Santa Gloria") {
    return name.replace(/^Santa Gloria\s+/i, "SG ");
  }
  if (row.marca === "Tim Hortons") {
    return name.replace(/^Tim Hortons\s+/i, "TH ");
  }
  if (row.marca === "Sibuya") {
    return name.replace(/^Sibuya\s+/i, "Sibuya ");
  }
  if (row.marca === "Taberna Volapié") {
    return "Volapié";
  }

  return name.replace(/^BK Pamplona Mercaderes$/i, "BK Mercaderes");
}

function aggregateBrand(
  marca: string,
  rows: RestaurantSummaryRow[]
): BrandSummary {
  const meta = brandMeta(marca);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const ratingSum = rows.reduce((sum, row) => sum + row.ratingSum, 0);

  return {
    marca,
    ...meta,
    target: rows[0]?.target ?? 4.4,
    total,
    ratingSum,
    media: total > 0 ? ratingSum / total : 0,
    positivas: rows.reduce((sum, row) => sum + row.positivas, 0),
    neutras: rows.reduce((sum, row) => sum + row.neutras, 0),
    negativas: rows.reduce((sum, row) => sum + row.negativas, 0),
    rows,
  };
}

function globalAnalysis(
  media: number,
  total: number,
  positivas: number,
  neutras: number,
  negativas: number,
  target: number
): string[] {
  if (total === 0) {
    return [
      "Todavía no hay reseñas registradas en el periodo semanal.",
      "Las medias se irán formando a medida que entren nuevas valoraciones.",
    ];
  }

  const lines: string[] = [];

  if (media >= target) {
    lines.push(
      `El grupo se mantiene por encima del objetivo con una media de ${formatMedia(media)}⭐.`
    );
  } else {
    lines.push(
      `El periodo se sitúa por debajo del objetivo con una media de ${formatMedia(media)}⭐.`
    );
  }

  if (total <= 15) {
    lines.push(
      `El volumen todavía es reducido: ${pluralResena(total)}. Cada nueva valoración puede mover la media con bastante fuerza.`
    );
  } else if (negativas > 0) {
    lines.push(
      `Las ${negativas} negativas representan el ${((negativas / total) * 100).toFixed(1).replace(".", ",")}% del volumen semanal.`
    );
  } else if (neutras > 0) {
    lines.push(
      `No hay negativas en el periodo; se registran ${neutras} valoraciones neutrales de 3⭐.`
    );
  } else {
    lines.push(
      `Las ${positivas} valoraciones registradas son positivas y no hay reseñas de 1–3⭐.`
    );
  }

  return lines;
}

function brandAnalysis(brand: BrandSummary): string[] {
  if (brand.total === 0) {
    return [];
  }

  const active = brand.rows.filter((row) => row.total > 0);
  const poor = [...active].filter((row) => row.media < brand.target).sort((a, b) => a.media - b.media);
  const strong = [...active].filter((row) => row.media >= brand.target).sort((a, b) => b.media - a.media);

  const lines: string[] = [
    `${brand.marca} acumula ${formatMedia(brand.media)}⭐ con ${pluralResena(brand.total)} esta semana.`,
  ];

  if (poor.length > 0) {
    const weakest = poor[0];
    lines.push(
      `El principal foco es ${displayRestaurantName(weakest)}, con ${formatMedia(weakest.media)}⭐ y ${pluralResena(weakest.total)}.`
    );
  }

  if (strong.length > 0) {
    const best = strong[0];
    if (!poor.length || best.id !== poor[0]?.id) {
      lines.push(
        `${displayRestaurantName(best)} se mantiene en objetivo con ${formatMedia(best.media)}⭐.`
      );
    }
  }

  if (brand.total <= 3) {
    lines.push(
      "El volumen todavía es demasiado bajo para interpretar la media como una tendencia consolidada."
    );
  }

  return lines;
}

function renderRestaurantGroup(
  title: string,
  emoji: string,
  rows: RestaurantSummaryRow[],
  target: number
): string[] {
  if (rows.length === 0) return [];

  const lines: string[] = ["", `${emoji} ${title}`, ""];

  for (const row of rows) {
    const name = displayRestaurantName(row);
    const media = formatMedia(row.media);
    const needed = positiveReviewsNeeded(row.ratingSum, row.total, target);

    if (row.total === 0) {
      lines.push(`⚪ ${name}`);
      continue;
    }

    lines.push(`${emoji} ${name} — ${media}⭐`);
    lines.push(`📊 ${pluralResena(row.total)}`);

    if (needed > 0) {
      lines.push(
        `📈 +${needed} ${needed === 1 ? "positiva" : "positivas"} para objetivo`
      );
    }

    lines.push("");
  }

  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function renderBrandSection(brand: BrandSummary): string[] {
  const lines: string[] = [
    "",
    DIVIDER,
    `${brand.emoji} ${brand.title}`,
  ];

  if (brand.total > 0) {
    lines.push(`⭐ ${formatMedia(brand.media)}⭐ · ${pluralResena(brand.total)}`);
  }

  lines.push(DIVIDER);

  const red = brand.rows.filter(
    (row) => statusFor(row.media, row.total, row.target) === "red"
  );
  const yellow = brand.rows.filter(
    (row) => statusFor(row.media, row.total, row.target) === "yellow"
  );
  const green = brand.rows.filter(
    (row) => statusFor(row.media, row.total, row.target) === "green"
  );
  const empty = brand.rows.filter((row) => row.total === 0);

  if (red.length > 0) {
    lines.push(...renderRestaurantGroup("🔴 FUERA DE OBJETIVO", "🔴", red, brand.target));
  }

  if (red.length > 0 && (yellow.length > 0 || green.length > 0 || empty.length > 0)) {
    lines.push("", THIN_DIVIDER);
  }

  if (yellow.length > 0) {
    lines.push(...renderRestaurantGroup("🟡 EN VIGILANCIA", "🟡", yellow, brand.target));
  }

  if (yellow.length > 0 && (green.length > 0 || empty.length > 0)) {
    lines.push("", THIN_DIVIDER);
  }

  if (green.length > 0) {
    lines.push(...renderRestaurantGroup("🟢 EN OBJETIVO", "🟢", green, brand.target));
  }

  if (green.length > 0 && empty.length > 0) {
    lines.push("", THIN_DIVIDER);
  }

  if (empty.length > 0) {
    lines.push(...renderRestaurantGroup("⚪ SIN RESEÑAS", "⚪", empty, brand.target));
  }

  const analysis = brandAnalysis(brand);
  if (analysis.length > 0) {
    lines.push("", `🎯 Análisis ${brand.shortLabel}`, "");
    lines.push(...analysis.flatMap((line) => [line, ""]));
    if (lines[lines.length - 1] === "") lines.pop();
  }

  return lines;
}

function focusLines(brands: BrandSummary[]): string[] {
  const allRows = brands.flatMap((brand) => brand.rows).filter((row) => row.total > 0);
  if (allRows.length === 0) {
    return ["📊 Volumen", "Todavía no hay reseñas registradas esta semana."];
  }

  const poor = [...allRows]
    .filter((row) => row.media < row.target)
    .sort((a, b) => {
      if (a.media !== b.media) return a.media - b.media;
      return b.total - a.total;
    });

  const strongBrands = [...brands]
    .filter((brand) => brand.total > 0 && brand.media >= brand.target)
    .sort((a, b) => b.media - a.media);

  const lines: string[] = [];

  for (const row of poor.slice(0, 3)) {
    const status = statusFor(row.media, row.total, row.target);
    const emoji = status === "yellow" ? "🟡" : "🔴";
    lines.push(
      `${emoji} ${displayRestaurantName(row)}`,
      `${formatMedia(row.media)}⭐ con ${pluralResena(row.total)} esta semana.`,
      ""
    );
  }

  if (strongBrands.length > 0) {
    const best = strongBrands[0];
    lines.push(
      `🟢 ${best.marca}`,
      `Media de ${formatMedia(best.media)}⭐ con ${pluralResena(best.total)}.`,
      ""
    );
  }

  const total = allRows.reduce((sum, row) => sum + row.total, 0);
  lines.push(
    "📊 Volumen",
    total <= 15
      ? `Solo hay ${total} reseñas en todo el grupo, por lo que las medias todavía son muy sensibles a cada nueva valoración.`
      : `El grupo acumula ${total} reseñas esta semana.`
  );

  return lines;
}

export async function buildAgentDailySummaryPreview(
  agentId: string
): Promise<AgentDailySummaryPreview> {
  const client = requireAdminClient();

  const { data: access, error: accessError } = await client
    .from(SUPABASE_TABLES.nexo_bot_accesos)
    .select("id,nombre,todos_restaurantes,restaurante_ids")
    .eq("id", agentId)
    .maybeSingle();

  if (accessError) throw accessError;
  if (!access) throw new Error("Agente no encontrado.");

  const accessRow = access as AccessRow;
  const allowedIds = normalizeIds(accessRow.restaurante_ids ?? []);

  let restaurantQuery = client
    .from(SUPABASE_TABLES.restaurantes)
    .select("id,nombre,ciudad,marca_id,empresa_id")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (!accessRow.todos_restaurantes) {
    if (allowedIds.length === 0) {
      throw new Error("El agente no tiene restaurantes asignados.");
    }
    restaurantQuery = restaurantQuery.in("id", allowedIds);
  }

  const { data: restaurantData, error: restaurantError } = await restaurantQuery;
  if (restaurantError) throw restaurantError;

  const restaurants = (restaurantData ?? []).map(
    (row): RestaurantRow => ({
      id: Number(row.id),
      nombre: String(row.nombre ?? "Restaurante"),
      ciudad: row.ciudad ? String(row.ciudad) : null,
      marca_id: row.marca_id == null ? null : Number(row.marca_id),
      empresa_id: row.empresa_id == null ? null : Number(row.empresa_id),
    })
  );

  if (restaurants.length === 0) {
    throw new Error("No hay restaurantes activos para este agente.");
  }

  const brandIds = Array.from(
    new Set(restaurants.map((row) => row.marca_id).filter((id): id is number => id != null))
  );

  const { data: brandData, error: brandError } = await client
    .from(SUPABASE_TABLES.marcas)
    .select("id,nombre,objetivo_media")
    .in("id", brandIds);

  if (brandError) throw brandError;

  const brandsById = new Map<number, BrandRow>(
    (brandData ?? []).map((row) => [
      Number(row.id),
      {
        id: Number(row.id),
        nombre: String(row.nombre ?? "Marca"),
        objetivo_media: metricNumber(row.objetivo_media) || 4.4,
      },
    ])
  );

  const companyIds = Array.from(
    new Set(restaurants.map((row) => row.empresa_id).filter((id): id is number => id != null))
  );

  let companyName = "Grupo";
  if (companyIds.length === 1) {
    const { data: company } = await client
      .from(SUPABASE_TABLES.empresas)
      .select("nombre")
      .eq("id", companyIds[0])
      .maybeSingle();

    if (company?.nombre) companyName = String(company.nombre);
  }

  const todayKey = toDateKey(new Date());
  const weekStartKey = mondayOf(todayKey);
  const weekEndKey = addDays(weekStartKey, 6);
  const restaurantIds = restaurants.map((restaurant) => restaurant.id);

  const metricRows = await fetchSupabaseCanonicalReputationMetrics(
    weekStartKey,
    todayKey,
    restaurantIds
  );

  const metricsByRestaurant = new Map<number, SupabaseMetricRow>(
    metricRows.map((row) => [metricNumber(row.restaurante_id), row])
  );

  const summaryRows: RestaurantSummaryRow[] = restaurants.map((restaurant) => {
    const brand = restaurant.marca_id == null ? null : brandsById.get(restaurant.marca_id);
    const metrics = metricsByRestaurant.get(restaurant.id);

    return {
      ...restaurant,
      marca: brand?.nombre ?? "Otros",
      target: brand?.objetivo_media ?? 4.4,
      total: metricNumber(metrics?.total_resenas),
      ratingSum: metricNumber(metrics?.rating_sum),
      media: metricNumber(metrics?.media_exacta),
      positivas: metricNumber(metrics?.positivas),
      neutras: metricNumber(metrics?.neutras),
      negativas: metricNumber(metrics?.negativas),
    };
  });

  const grouped = new Map<string, RestaurantSummaryRow[]>();
  for (const row of summaryRows) {
    const list = grouped.get(row.marca) ?? [];
    list.push(row);
    grouped.set(row.marca, list);
  }

  const brandOrder = [
    "Burger King",
    "Popeyes",
    "Santa Gloria",
    "Ribs",
    "Sibuya",
    "Tim Hortons",
    "Taberna Volapié",
  ];

  const brands = brandOrder
    .filter((marca) => grouped.has(marca))
    .map((marca) => aggregateBrand(marca, grouped.get(marca) ?? []));

  for (const [marca, rows] of grouped) {
    if (!brandOrder.includes(marca)) {
      brands.push(aggregateBrand(marca, rows));
    }
  }

  const total = brands.reduce((sum, brand) => sum + brand.total, 0);
  const ratingSum = brands.reduce((sum, brand) => sum + brand.ratingSum, 0);
  const positivas = brands.reduce((sum, brand) => sum + brand.positivas, 0);
  const neutras = brands.reduce((sum, brand) => sum + brand.neutras, 0);
  const negativas = brands.reduce((sum, brand) => sum + brand.negativas, 0);
  const media = total > 0 ? ratingSum / total : 0;
  const target = brands[0]?.target ?? 4.4;

  const lines: string[] = [
    DIVIDER,
    "📊 𝗜𝗡𝗙𝗢𝗥𝗠𝗘 𝗗𝗜𝗔𝗥𝗜𝗢",
    `📅 ${formatReportDate(todayKey)}`,
    `📆 Periodo: ${formatWeeklyPeriod(weekStartKey, weekEndKey)}`,
    `🏤 ${companyName}`,
    DIVIDER,
    "",
    `🎯 Objetivo: ${formatMedia(target)}⭐`,
    "",
    "🔴 Fuera de objetivo",
    "🟡 En vigilancia",
    "🟢 En objetivo",
    "⚪ Sin reseñas",
    "",
    DIVIDER,
    "📈 𝗦𝗜𝗧𝗨𝗔𝗖𝗜𝗢́𝗡 𝗚𝗟𝗢𝗕𝗔𝗟",
    DIVIDER,
    "",
    `⭐ ${formatMedia(media)}⭐`,
    `📊 ${pluralResena(total)}`,
    "",
    `✅ ${positivas} positivas`,
    `➖ ${neutras} neutras`,
    `🔴 ${negativas} negativas`,
    "",
    ...globalAnalysis(media, total, positivas, neutras, negativas, target),
    "",
  ];

  for (const brand of brands.filter((item) => item.total > 0)) {
    lines.push(
      `${brand.emoji} ${brand.shortLabel} — ${formatMedia(brand.media)}⭐ · ${pluralResena(brand.total)}`
    );
  }

  for (const brand of brands) {
    lines.push(...renderBrandSection(brand));
  }

  lines.push(
    "",
    DIVIDER,
    "🎯 𝗙𝗢𝗖𝗢 𝗗𝗘𝗟 𝗗𝗜́𝗔",
    DIVIDER,
    "",
    ...focusLines(brands),
    "",
    DIVIDER,
    "💜 𝗡𝗘𝗫𝗢 𝗢𝗥𝗜𝗚𝗘𝗡",
    DIVIDER,
    "",
    `⭐ ${formatMedia(media)}⭐`,
    `📊 ${pluralResena(total)}`,
    `🎯 Objetivo: ${formatMedia(target)}⭐`,
    "",
    ...globalAnalysis(media, total, positivas, neutras, negativas, target)
  );

  return {
    agentId,
    generatedAt: new Date().toISOString(),
    dateKey: todayKey,
    message: lines.join("\n").replace(/\n{3,}/g, "\n\n"),
  };
}
