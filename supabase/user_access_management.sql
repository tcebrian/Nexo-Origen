-- NEXO-CONV-014 — Gestión de permisos de usuarios (web + WhatsApp + informes).
--
-- UNA sola fuente de verdad del alcance de cada persona:
--   perfiles (rol, empresa)  +  usuario_marcas  +  usuario_restaurantes  →  fetchUserScope
-- La web, el contacto de WhatsApp (conv_contactos.usuario_id) y los futuros informes
-- diarios consumen ese mismo resultado. Aquí solo se añade:
--
--   1) nexo_set_user_access(...): cambia rol/empresa y deja las asignaciones de la
--      persona EXACTAMENTE como la selección final, en UNA transacción (una función
--      PL/pgSQL es atómica: un fallo a mitad no deja permisos a medias). Valida en la
--      propia base que los restaurantes y marcas son de la empresa de la persona y
--      limpia las asignaciones que el rol nuevo no usa (así un cambio de rol nunca
--      deja restos que amplíen el acceso).
--        · empresa_admin    → todos los restaurantes de su empresa (sin filas en las tablas)
--        · marca_admin      → todos los restaurantes de sus marcas (usuario_marcas)
--        · restaurante_user → los restaurantes de usuario_restaurantes (varios)
--      No permite crear ni degradar super_admin: eso no se gestiona desde la web.
--   2) conv_contactos.usuario_id único (parcial): un usuario de Nexo = un teléfono de
--      WhatsApp. Comprobado antes de aplicar: sin duplicados.
--
-- Solo ejecutable con la service role (el servidor tras comprobar super_admin).
-- Idempotente.

create or replace function public.nexo_set_user_access(
  p_user_id uuid,
  p_rol text,
  p_empresa_id bigint,
  p_restaurante_ids bigint[],
  p_marca_ids bigint[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rol_actual text;
  v_restaurantes bigint[] := coalesce(array(select distinct x from unnest(p_restaurante_ids) x where x is not null), '{}');
  v_marcas bigint[] := coalesce(array(select distinct x from unnest(p_marca_ids) x where x is not null), '{}');
begin
  select rol into v_rol_actual from public.perfiles where id = p_user_id for update;
  if not found then
    raise exception 'usuario no encontrado' using errcode = 'P0002';
  end if;

  -- super_admin no se crea ni se modifica desde aquí.
  if v_rol_actual = 'super_admin' or p_rol = 'super_admin' then
    raise exception 'rol no gestionable' using errcode = '42501';
  end if;
  if p_rol not in ('empresa_admin', 'marca_admin', 'restaurante_user') then
    raise exception 'rol no válido' using errcode = '22023';
  end if;
  if p_empresa_id is null or not exists (select 1 from public.empresas where id = p_empresa_id) then
    raise exception 'empresa no válida' using errcode = '22023';
  end if;

  if p_rol = 'restaurante_user' then
    -- Cada restaurante debe existir y ser de la empresa de la persona.
    if exists (
      select 1 from unnest(v_restaurantes) r
      where not exists (select 1 from public.restaurantes x where x.id = r and x.empresa_id = p_empresa_id)
    ) then
      raise exception 'restaurante de otra empresa o inexistente' using errcode = '22023';
    end if;
  elsif p_rol = 'marca_admin' then
    -- Cada marca debe tener al menos un restaurante en la empresa de la persona.
    if exists (
      select 1 from unnest(v_marcas) m
      where not exists (select 1 from public.restaurantes x where x.marca_id = m and x.empresa_id = p_empresa_id)
    ) then
      raise exception 'marca de otra empresa o inexistente' using errcode = '22023';
    end if;
  end if;

  update public.perfiles set rol = p_rol, empresa_id = p_empresa_id where id = p_user_id;

  -- Restaurantes: solo restaurante_user los usa; el resto de roles queda sin filas.
  delete from public.usuario_restaurantes
  where user_id = p_user_id
    and (p_rol <> 'restaurante_user' or restaurante_id <> all (v_restaurantes));
  if p_rol = 'restaurante_user' then
    insert into public.usuario_restaurantes (user_id, restaurante_id)
    select p_user_id, r from unnest(v_restaurantes) r
    on conflict (user_id, restaurante_id) do nothing;
  end if;

  -- Marcas: solo marca_admin las usa.
  delete from public.usuario_marcas
  where user_id = p_user_id
    and (p_rol <> 'marca_admin' or marca_id <> all (v_marcas));
  if p_rol = 'marca_admin' then
    insert into public.usuario_marcas (user_id, marca_id)
    select p_user_id, m from unnest(v_marcas) m
    on conflict (user_id, marca_id) do nothing;
  end if;
end;
$$;

revoke all on function public.nexo_set_user_access(uuid, text, bigint, bigint[], bigint[]) from public, anon, authenticated;
grant execute on function public.nexo_set_user_access(uuid, text, bigint, bigint[], bigint[]) to service_role;

comment on function public.nexo_set_user_access(uuid, text, bigint, bigint[], bigint[]) is
  '[ACCESS] Cambia rol/empresa de una persona y deja sus asignaciones (usuario_restaurantes / usuario_marcas) exactamente como la selección final, en una transacción, validando empresa. Solo service role.';

create unique index if not exists conv_contactos_usuario_id_key
  on public.conv_contactos (usuario_id)
  where usuario_id is not null;
