import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { WeeklyReportData, WeeklyTemplateId } from "./weekly/types";

export type ReportType = "semanal" | "mensual" | "trimestral" | "prevent" | "restaurante";
export type ReportFormat = "ejecutivo" | "operativo";
export type ReportStatus = "stable" | "attention" | "risk";
export type LibrarySection = "semanal" | "mensual" | "trimestral";

export type ReportSummary = {
  onTarget: number;
  onWatch: number;
  atRisk: number;
};

export type ReportExpress = {
  bestRestaurant: string;
  bestImprovement: string;
  highestRisk: string;
  preventProtection: number;
};

export type ReportRecord = {
  id: string;
  title: string;
  type: ReportType;
  librarySection?: LibrarySection;
  company: string;
  brand: BrandId | "todas";
  brandLabel: string;
  periodLabel: string;
  date: Date;
  restaurantsAnalyzed: number;
  status: ReportStatus;
  summary: ReportSummary;
  express: ReportExpress;
  /** Plantilla PDF semanal (bk, grupo-hambar, sg, tim-hortons) */
  weeklyTemplateId?: WeeklyTemplateId;
  /** Datos PDF generados desde Supabase KPI */
  weeklyData?: WeeklyReportData;
};

export type ReportAutomation = {
  id: string;
  title: string;
  schedule: string;
  recipients: string;
  active: boolean;
  brand?: BrandId;
};

export type ReportFilters = {
  brand: "todas" | BrandId;
  type: "todos" | ReportType;
};

export type GenerateReportInput = {
  type: ReportType;
  company: string;
  brand: "todas" | BrandId;
  restaurant: string;
  start: Date;
  end: Date;
  format: ReportFormat;
  sendEmail: boolean;
  saveToLibrary: boolean;
};

export type DateRange = {
  start: Date;
  end: Date;
};
