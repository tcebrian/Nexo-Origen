-- Políticas de lectura para el dashboard (anon + authenticated)
-- Ejecutar en Supabase → SQL Editor
--
-- NOTA: kpi_restaurantes es una VIEW (no tabla). No uses RLS en vistas.
--       Solo necesita GRANT SELECT (ver supabase/kpi_restaurantes.sql).

ALTER TABLE public.kpi_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kpi_diario_select_all" ON public.kpi_diario;
CREATE POLICY "kpi_diario_select_all" ON public.kpi_diario FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "resenas_select_all" ON public.resenas;
CREATE POLICY "resenas_select_all" ON public.resenas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "restaurantes_select_all" ON public.restaurantes;
CREATE POLICY "restaurantes_select_all" ON public.restaurantes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "marcas_select_all" ON public.marcas;
CREATE POLICY "marcas_select_all" ON public.marcas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dashboard_kpis_select_all" ON public.dashboard_kpis;
CREATE POLICY "dashboard_kpis_select_all" ON public.dashboard_kpis FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.kpi_diario TO anon, authenticated;
GRANT SELECT ON public.resenas TO anon, authenticated;
GRANT SELECT ON public.restaurantes TO anon, authenticated;
GRANT SELECT ON public.marcas TO anon, authenticated;
GRANT SELECT ON public.dashboard_kpis TO anon, authenticated;

-- Vista de snapshot por restaurante (solo lectura, sin RLS):
GRANT SELECT ON public.kpi_restaurantes TO anon, authenticated;
