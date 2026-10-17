import { addCalendarDays, madridClock, mondayOf } from "@/lib/reports/daily/calendar";
import type { CompanyAccess, CompanyOption } from "./access";

/**
 * Tarjetas de la pantalla "Selecciona tu empresa": nombre + media global REAL de reputación.
 * La media no se calcula aquí: se delega en el motor canónico (`fetchNetworkAverage`), con los restaurantes
 * de ESA empresa que el usuario puede ver. No hay media de medias ni fórmulas nuevas.
 */

export type CompanyCard = { id: number; name: string; average: number | null };

export type DashboardPeriod = { startKey: string; endKey: string };

/** Periodo por defecto del dashboard: la semana natural actual (lunes a domingo, hora de Madrid). */
export function defaultDashboardPeriod(now: Date): DashboardPeriod {
  const today = madridClock(now).date;
  const monday = mondayOf(today);
  return { startKey: monday, endKey: addCalendarDays(monday, 6) };
}

export async function buildCompanyCards(input: {
  access: Pick<CompanyAccess, "companies" | "restaurantIdsByCompany">;
  /** Restaurantes del catálogo canónico (los mismos que usa el dashboard). */
  catalogIds: ReadonlySet<number>;
  period: DashboardPeriod;
  /** Motor canónico: media global de un conjunto de restaurantes en el periodo, o `null` si no hay reseñas. */
  fetchNetworkAverage: (restaurantIds: number[], period: DashboardPeriod) => Promise<number | null>;
  onError?: (company: CompanyOption) => void;
}): Promise<CompanyCard[]> {
  return Promise.all(
    input.access.companies.map(async (company): Promise<CompanyCard> => {
      // Solo los restaurantes de ESTA empresa que el usuario puede ver: ninguna reseña de otra empresa entra.
      const ids = (input.access.restaurantIdsByCompany.get(company.id) ?? []).filter((id) => input.catalogIds.has(id));
      if (ids.length === 0) return { id: company.id, name: company.name, average: null };
      try {
        return { id: company.id, name: company.name, average: await input.fetchNetworkAverage(ids, input.period) };
      } catch {
        input.onError?.(company);
        return { id: company.id, name: company.name, average: null };
      }
    })
  );
}

const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "4,34" (o "—" si la empresa aún no tiene reseñas en el periodo). */
export function formatCompanyAverage(average: number | null): string {
  return average === null || !Number.isFinite(average) ? "—" : decimal.format(average);
}
