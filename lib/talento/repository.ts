import type { DateRange, TalentoPayload } from "./types";

export type TalentoQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

export type TalentoRepository = {
  listEmployees(query: TalentoQuery): Promise<TalentoPayload>;
};

let repository: TalentoRepository | null = null;

export async function getTalentoRepository(): Promise<TalentoRepository> {
  if (!repository) {
    const { supabaseTalentoRepository } = await import("./supabase-repository");
    repository = supabaseTalentoRepository;
  }
  return repository;
}

export type { DateRange };
