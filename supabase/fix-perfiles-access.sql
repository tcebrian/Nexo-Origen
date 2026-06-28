-- Ejecutar en Supabase → SQL Editor
-- Permite que un usuario autenticado lea SU fila en perfiles (id = auth.users.id)

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_select_own ON public.perfiles;

CREATE POLICY perfiles_select_own ON public.perfiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

GRANT SELECT ON public.perfiles TO authenticated;
