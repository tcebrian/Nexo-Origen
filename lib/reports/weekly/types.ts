import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type WeeklyTemplateId = "bk" | "grupo-hambar" | "sg" | "tim-hortons";

export type WeeklyLocationStatus = "on_target" | "watch" | "risk" | "no_reviews";

export type WeeklyLocationRow = {
  name: string;
  brandId?: BrandId;
  brandLabel?: string;
  weeklyRating: number | null;
  reviewCount: number;
  status: WeeklyLocationStatus;
  reason: string;
};

export type NegativeReasonSegment = {
  label: string;
  count: number;
  percent: number;
  color: [number, number, number];
};

export type WeeklyReportKpis = {
  belowTargetCount: number;
  belowTargetLocations: string[];
  belowTargetNote?: string;
  totalReviews: number;
  negativeReviews: number;
  negativePercent: number;
  weeklyAverage: number;
  targetAverage: number;
};

export type TimHortonsLocationCard = {
  name: string;
  weeklyRating: number;
  totalReviews: number;
  negativeReviews: number;
  positivePercent: number;
};

export type TimHortonsHighlight = {
  title: string;
  description: string;
};

export type TimHortonsComparison = {
  locationA: TimHortonsLocationCard;
  locationB: TimHortonsLocationCard;
  comparisonSummary: string;
  highlights: TimHortonsHighlight[];
  conclusions: string[];
  franchiseSummary: {
    globalRating: number;
    totalReviews: number;
    negativeReviews: number;
    positivePercent: number;
  };
};

export type WeeklyReportTheme = {
  headerImage: string;
  headerBg: [number, number, number];
  titleColor: [number, number, number];
  accentColor: [number, number, number];
  kpiAccent: [number, number, number];
  pageBg: [number, number, number];
  tableHeaderBg: [number, number, number];
  brandTitle: string;
  brandSubtitle: string;
  networkLabel: string;
  multiBrand?: boolean;
};

export type WeeklyReportData = {
  templateId: WeeklyTemplateId;
  theme: WeeklyReportTheme;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  kpis: WeeklyReportKpis;
  locations: WeeklyLocationRow[];
  negativeReasons: NegativeReasonSegment[];
  footerMonthLabel: string;
  comparison?: TimHortonsComparison;
};
