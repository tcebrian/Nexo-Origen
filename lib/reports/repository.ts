import type { ReportAutomation, ReportRecord } from "./types";

export type ReportsQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

export type ReportsRepository = {
  getLatest(query: ReportsQuery): Promise<ReportRecord>;
  listLibrary(query: ReportsQuery): Promise<ReportRecord[]>;
  listAutomations(): Promise<ReportAutomation[]>;
};

let repository: ReportsRepository | null = null;

export async function getReportsRepository(): Promise<ReportsRepository> {
  if (!repository) {
    const { supabaseReportsRepository } = await import("./supabase-repository");
    repository = supabaseReportsRepository;
  }
  return repository;
}
