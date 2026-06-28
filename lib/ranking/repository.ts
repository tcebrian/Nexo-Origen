import type { RankingRecord } from "./types";

export type RankingQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

export type RankingRepository = {
  list(query: RankingQuery): Promise<RankingRecord[]>;
};

let repository: RankingRepository | null = null;

export async function getRankingRepository(): Promise<RankingRepository> {
  if (!repository) {
    const { supabaseRankingRepository } = await import("./supabase-repository");
    repository = supabaseRankingRepository;
  }
  return repository;
}
