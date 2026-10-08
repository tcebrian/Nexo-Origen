-- Cambio de contraseña obligatorio en el primer acceso.
--
-- El super_admin crea el usuario con una contraseña inicial (solo viaja servidor →
-- Supabase Auth; nunca se guarda en `perfiles` ni en ninguna tabla). Si marca
-- "Obligar a cambiar contraseña al primer acceso", `must_change_password` queda en true
-- y el middleware envía a esa persona a /auth/change-password hasta que la cambie.
-- El servidor lo pone a false SOLO después de actualizar la contraseña en Supabase Auth.
--
-- Aditivo e idempotente: las cuentas existentes quedan en false (no se les exige nada).
-- Rollback: alter table public.perfiles drop column must_change_password;

alter table public.perfiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.perfiles.must_change_password is
  '[ACCESS] true = la persona debe cambiar su contraseña antes de usar Nexo (se pone a false al cambiarla). No guarda ninguna contraseña.';
