/**
 * Referencia de objetos Supabase usados por la app.
 * Vistas = solo lectura (SELECT). Tablas = pueden tener RLS.
 */

export const SUPABASE_VIEWS = {
  /** Snapshot KPI por restaurante — VIEW, lectura con GRANT (sin RLS). */
  kpi_restaurantes: "kpi_restaurantes",
} as const;

export const SUPABASE_TABLES = {
  marcas: "marcas",
  restaurantes: "restaurantes",
  resenas: "resenas",
  kpi_diario: "kpi_diario",
  dashboard_kpis: "dashboard_kpis",
  perfiles: "perfiles",
  analisis_ia: "analisis_ia",
  resena_motivos: "resena_motivos",
  empresas: "empresas",
  usuario_marcas: "usuario_marcas",
  usuario_restaurantes: "usuario_restaurantes",
  nexo_bot_accesos: "nexo_bot_accesos",
  nexo_bot_conversaciones: "nexo_bot_conversaciones",
  nexo_bot_sesiones: "nexo_bot_sesiones",
  restaurante_integraciones: "restaurante_integraciones",
  nexo_bot_resumenes_envios: "nexo_bot_resumenes_envios",
} as const;

export type SupabaseView = (typeof SUPABASE_VIEWS)[keyof typeof SUPABASE_VIEWS];
export type SupabaseTable = (typeof SUPABASE_TABLES)[keyof typeof SUPABASE_TABLES];
