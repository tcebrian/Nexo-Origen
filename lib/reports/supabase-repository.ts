import { toDateKey } from "@/lib/dates/period";
import type { ReportAutomation, ReportRecord } from "./types";
import type { ReportsQuery, ReportsRepository } from "./repository";

type SerializedReport = Omit<ReportRecord, "date" | "weeklyData"> & {
  date: string;
  weeklyData?: ReportRecord["weeklyData"] extends infer T
    ? T extends object
      ? Omit<T, "periodStart" | "periodEnd"> & {
          periodStart: string;
          periodEnd: string;
        }
      : never
    : never;
};

type ReportsPayload = {
  reports: SerializedReport[];
};

const EMPTY_REPORT: ReportRecord = {
  id: "report-empty",
  title: "Sin informes para el periodo",
  type: "semanal",
  librarySection: "semanal",
  company: "Grupo Hambar",
  brand: "todas",
  brandLabel: "Grupo Hámbar",
  periodLabel: "Periodo sin datos",
  date: new Date(),
  restaurantsAnalyzed: 0,
  status: "stable",
  summary: { onTarget: 0, onWatch: 0, atRisk: 0 },
  express: {
    bestRestaurant: "Sin datos",
    bestImprovement: "Sin datos",
    highestRisk: "Sin datos",
    preventProtection: 0,
  },
};

let cachedKey = "";
let cachedPromise: Promise<ReportRecord[]> | null = null;

function hydrateReport(raw: SerializedReport): ReportRecord {
  return {
    ...raw,
    date: new Date(raw.date),
    weeklyData: raw.weeklyData
      ? {
          ...raw.weeklyData,
          periodStart: new Date(raw.weeklyData.periodStart),
          periodEnd: new Date(raw.weeklyData.periodEnd),
        }
      : undefined,
  } as ReportRecord;
}

async function fetchReports(query: ReportsQuery): Promise<ReportRecord[]> {
  const startKey = toDateKey(query.start);
  const endKey = toDateKey(query.end);
  const key = `${startKey}:${endKey}`;

  if (cachedPromise && cachedKey === key) return cachedPromise;

  cachedKey = key;
  cachedPromise = (async () => {
    const params = new URLSearchParams({ start: startKey, end: endKey });
    const response = await fetch(`/api/reports/data?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudieron cargar los informes.");
    }

    const payload = (await response.json()) as ReportsPayload;
    return (payload.reports ?? []).map(hydrateReport);
  })().catch((error) => {
    cachedPromise = null;
    cachedKey = "";
    throw error;
  });

  return cachedPromise;
}

export const supabaseReportsRepository: ReportsRepository = {
  async getLatest(query) {
    const reports = await fetchReports(query);
    return reports[0] ?? { ...EMPTY_REPORT, date: query.end };
  },

  async listLibrary(query) {
    return fetchReports(query);
  },

  async listAutomations(): Promise<ReportAutomation[]> {
    return [];
  },
};
