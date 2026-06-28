/**
 * Datos estáticos y vacíos para desarrollo sin Supabase o pruebas de UI.
 * No incluir credenciales ni datos sensibles.
 */
import { brands } from "@/app/dashboard/restaurantes/data";
import type { TalentoPayload } from "@/lib/talento/types";

export const MOCK_BRANDS = brands;

export const EMPTY_TALENTO_PAYLOAD: TalentoPayload = {
  employees: [],
  summaryTrends: {
    employeesMentionedDelta: 0,
    positiveMentionsDelta: 0,
    negativeMentionsDelta: 0,
  },
};

export const EMPTY_DASHBOARD_SUMMARY = {
  mediaGlobal: 0,
  totalResenas: 0,
  totalPositivas: 0,
  totalNegativas: 0,
  positivePct: 0,
  negativePct: 0,
  totalRestaurantes: 0,
  ranking: [] as const,
  restaurantesRiesgo: [] as const,
  alertas: [] as const,
  distribucionMarca: [] as const,
  resumenIA: "Sin datos — conecta Supabase para cargar el periodo.",
  peorRestaurante: null,
  restauranteMasNegativas: null,
  chartPending: true,
  chartLabels: [] as string[],
  chartValues: [] as number[],
  chartSource: "empty" as const,
  problemDistribution: [] as const,
};
