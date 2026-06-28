import type {
  EmployeeMention,
  EmployeeRecord,
  TalentoFeaturedComment,
  TalentoRestaurantRow,
  TalentoSummary,
  TalentoSummaryTrends,
  TalentoTrendItem,
  TalentoView,
} from "./types";

export function computePositivePercent(positive: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((positive / total) * 100);
}

export function buildEmployeeRecord(
  base: Omit<EmployeeRecord, "positivePercent" | "totalMentions"> & { totalMentions?: number }
): EmployeeRecord {
  const total =
    base.totalMentions ?? base.positiveMentions + base.negativeMentions + base.neutralMentions;

  return {
    ...base,
    totalMentions: total,
    positivePercent: computePositivePercent(base.positiveMentions, total),
  };
}

export function buildTalentoSummary(employees: EmployeeRecord[]): TalentoSummary {
  const employeesMentioned = employees.length;
  const positiveMentions = employees.reduce((s, e) => s + e.positiveMentions, 0);
  const negativeMentions = employees.reduce((s, e) => s + e.negativeMentions, 0);

  const top = [...employees].sort((a, b) => b.totalMentions - a.totalMentions)[0];

  return {
    employeesMentioned,
    positiveMentions,
    negativeMentions,
    topMentionedEmployee: top
      ? { name: top.name, mentions: top.totalMentions, id: top.id }
      : null,
  };
}

export function buildSummaryTrends(
  current: TalentoSummary,
  previous: TalentoSummary
): TalentoSummaryTrends {
  return {
    employeesMentionedDelta: current.employeesMentioned - previous.employeesMentioned,
    positiveMentionsDelta: current.positiveMentions - previous.positiveMentions,
    negativeMentionsDelta: current.negativeMentions - previous.negativeMentions,
  };
}

function sentimentToStars(sentiment: EmployeeMention["sentiment"]): number {
  if (sentiment === "positive") return 5;
  if (sentiment === "negative") return 2;
  return 3;
}

function buildSparkline(mentions: EmployeeMention[], points = 7): number[] {
  if (mentions.length === 0) return Array.from({ length: points }, () => 0);

  const sorted = [...mentions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const chunkSize = Math.max(1, Math.ceil(sorted.length / points));
  const values: number[] = [];

  for (let i = 0; i < points; i += 1) {
    const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length === 0) {
      values.push(values[values.length - 1] ?? 0);
      continue;
    }
    values.push(chunk.length);
  }

  return values;
}

function buildFeaturedComments(employees: EmployeeRecord[]): TalentoFeaturedComment[] {
  const comments: TalentoFeaturedComment[] = [];

  for (const employee of employees) {
    for (const mention of employee.mentions) {
      if (mention.sentiment !== "positive" || mention.excerpt.length < 12) continue;
      comments.push({
        id: `${employee.id}-${mention.reviewId}`,
        employeeId: employee.id,
        employeeName: employee.name,
        excerpt: mention.excerpt,
        restaurant: mention.restaurant,
        restaurantSlug: mention.restaurantSlug,
        brand: employee.brand,
        stars: sentimentToStars(mention.sentiment),
        reviewId: mention.reviewId,
        date: mention.date,
      });
    }
  }

  return comments
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6);
}

function buildRestaurantRows(employees: EmployeeRecord[]): TalentoRestaurantRow[] {
  const byRestaurant = new Map<
    string,
    {
      restaurant: string;
      restaurantSlug: string;
      brand: EmployeeRecord["brand"];
      employeeIds: Set<string>;
      positive: number;
      negative: number;
      top: { id: string; name: string; mentions: number } | null;
    }
  >();

  for (const employee of employees) {
    const entry = byRestaurant.get(employee.restaurantSlug) ?? {
      restaurant: employee.restaurant,
      restaurantSlug: employee.restaurantSlug,
      brand: employee.brand,
      employeeIds: new Set<string>(),
      positive: 0,
      negative: 0,
      top: null,
    };

    entry.employeeIds.add(employee.id);
    entry.positive += employee.positiveMentions;
    entry.negative += employee.negativeMentions;

    if (!entry.top || employee.totalMentions > entry.top.mentions) {
      entry.top = {
        id: employee.id,
        name: employee.name,
        mentions: employee.totalMentions,
      };
    }

    byRestaurant.set(employee.restaurantSlug, entry);
  }

  return [...byRestaurant.values()]
    .map((row) => ({
      restaurant: row.restaurant,
      restaurantSlug: row.restaurantSlug,
      brand: row.brand,
      employeesMentioned: row.employeeIds.size,
      positiveMentions: row.positive,
      negativeMentions: row.negative,
      topEmployee: row.top,
    }))
    .sort((a, b) => b.positiveMentions - a.positiveMentions)
    .slice(0, 8);
}

function buildTrendItems(employees: EmployeeRecord[]): TalentoTrendItem[] {
  const items: TalentoTrendItem[] = [];

  for (const employee of employees) {
    if (employee.mentionGrowth !== 0) {
      items.push({
        employee,
        label: "menciones vs. periodo anterior",
        value: `${employee.mentionGrowth >= 0 ? "+" : ""}${employee.mentionGrowth}%`,
        direction: employee.mentionGrowth > 0 ? "up" : employee.mentionGrowth < 0 ? "down" : "flat",
        sparkline: buildSparkline(employee.mentions),
      });
    } else if (employee.sentimentImprovement !== 0) {
      items.push({
        employee,
        label: "mejora en positivas",
        value: `${employee.sentimentImprovement >= 0 ? "+" : ""}${employee.sentimentImprovement} pp`,
        direction:
          employee.sentimentImprovement > 0
            ? "up"
            : employee.sentimentImprovement < 0
              ? "down"
              : "flat",
        sparkline: buildSparkline(employee.mentions),
      });
    }
  }

  return items
    .sort((a, b) => {
      const score = (item: TalentoTrendItem) =>
        item.direction === "up" ? 1 : item.direction === "down" ? -1 : 0;
      return score(b) - score(a) || b.employee.totalMentions - a.employee.totalMentions;
    })
    .slice(0, 5);
}

export function buildTalentoView(
  employees: EmployeeRecord[],
  summaryTrends: TalentoSummaryTrends = {
    employeesMentionedDelta: 0,
    positiveMentionsDelta: 0,
    negativeMentionsDelta: 0,
  }
): TalentoView {
  const summary = buildTalentoSummary(employees);

  const byMentions = [...employees].sort((a, b) => b.totalMentions - a.totalMentions);
  const featuredEmployees = [...employees]
    .filter((e) => e.positivePercent >= 60 && e.totalMentions >= 1)
    .sort((a, b) => b.positivePercent - a.positivePercent || b.totalMentions - a.totalMentions)
    .slice(0, 3);

  const fallbackFeatured = featuredEmployees.length > 0 ? featuredEmployees : byMentions.slice(0, 3);

  const featured = fallbackFeatured[0] ?? null;

  const improvementOpportunities = [...employees]
    .filter((e) => e.negativeMentions >= 1)
    .sort((a, b) => b.negativeMentions - a.negativeMentions)
    .slice(0, 3);

  const improving = [...employees]
    .filter((e) => e.sentimentImprovement > 0)
    .sort((a, b) => b.sentimentImprovement - a.sentimentImprovement)
    .slice(0, 4);

  const growing = [...employees]
    .filter((e) => e.mentionGrowth > 0)
    .sort((a, b) => b.mentionGrowth - a.mentionGrowth)
    .slice(0, 4);

  return {
    summary,
    summaryTrends,
    featuredEmployees: fallbackFeatured,
    featuredComments: buildFeaturedComments(employees),
    restaurantRows: buildRestaurantRows(employees),
    trendItems: buildTrendItems(employees),
    featured,
    mostMentioned: byMentions.slice(0, 8),
    improvementOpportunities,
    improving,
    growing,
  };
}
