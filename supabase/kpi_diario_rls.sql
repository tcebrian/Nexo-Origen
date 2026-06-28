-- =============================================================================
-- kpi_diario: permitir lectura al dashboard (anon + authenticated)
-- Ejecuta en Supabase → SQL Editor si /test-supabase muestra 0 filas en kpi_diario
-- =============================================================================

ALTER TABLE public.kpi_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kpi_diario_select_anon" ON public.kpi_diario;
DROP POLICY IF EXISTS "kpi_diario_select_all" ON public.kpi_diario;

CREATE POLICY "kpi_diario_select_all"
  ON public.kpi_diario
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.kpi_diario TO anon, authenticated;
