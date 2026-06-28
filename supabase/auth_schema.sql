-- =============================================================================
-- Nexo Origen — perfiles (esquema real en producción)
-- id uuid PRIMARY KEY = auth.users.id
-- empresa_id int8 (nullable; NULL válido para super_admin)
-- =============================================================================

-- Si creas la tabla desde cero:
-- CREATE TABLE public.perfiles (
--   id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
--   nombre text,
--   email text,
--   rol text NOT NULL,
--   empresa_id bigint,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   CONSTRAINT perfiles_rol_check CHECK (
--     rol IN ('super_admin', 'empresa_admin', 'marca_admin', 'restaurante_user')
--   )
-- );

-- Sin service role en .env: el usuario autenticado debe poder leer su fila.
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_select_own ON public.perfiles;

CREATE POLICY perfiles_select_own ON public.perfiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

GRANT SELECT ON public.perfiles TO authenticated;

-- -----------------------------------------------------------------------------
-- Insertar perfil (id DEBE ser el UUID de Authentication → Users)
-- -----------------------------------------------------------------------------
-- INSERT INTO public.perfiles (id, nombre, email, rol, empresa_id)
-- VALUES (
--   'UUID-COPIADO-DE-AUTH-USERS',
--   'Tomás Cebrián',
--   'tomascebrian622@gmail.com',
--   'super_admin',
--   NULL
-- );
