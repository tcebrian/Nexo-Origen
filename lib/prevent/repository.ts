import type { PreventRecord } from "./types";

export type PreventQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

export type PreventRepository = {
  list(query: PreventQuery): Promise<PreventRecord[]>;
};

let repository: PreventRepository | null = null;

export async function getPreventRepository(): Promise<PreventRepository> {
  if (!repository) {
    const { supabasePreventRepository } = await import("./supabase-repository");
    repository = supabasePreventRepository;
  }
  return repository;
}
