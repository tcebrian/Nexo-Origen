-- NEXO-CONV-015 — Permisos de CONTACTOS de WhatsApp gestionados en Conversations.
--
-- Decisión de producto: los contactos de WhatsApp (quien recibe informes, alertas o
-- consulta al bot) NO son cuentas web. Sus permisos se gestionan directamente en
-- Conversations con las tablas que ya existían:
--
--   conv_contactos              persona / teléfono (+ tipo descriptivo, + usuario_id OPCIONAL)
--   conv_contacto_empresas      empresa a la que tiene acceso (+ todos_restaurantes)
--   conv_contacto_restaurantes  restaurantes concretos permitidos (coherentes con la empresa
--                               por claves foráneas compuestas)
--
-- Reglas del alcance (DENY BY DEFAULT), resueltas en servidor con `resolveContactRestaurantIds`:
--   · sin empresa ni asignaciones                 → ningún restaurante
--   · todos_restaurantes = true                   → todos los restaurantes ACTUALES de la empresa
--                                                    (los nuevos entran solos)
--   · todos_restaurantes = false                  → solo los de conv_contacto_restaurantes
--   · conv_contactos.usuario_id NO interviene: es solo el vínculo opcional con una cuenta web.
--
-- Este script añade:
--   1) conv_contactos.tipo: etiqueta DESCRIPTIVA (dirección, operaciones, supervisor, …).
--      No decide permisos: estos salen solo de la empresa y los restaurantes elegidos.
--   2) nexo_set_contact_access(...): cambia nombre, tipo, empresa, "todos" y selección de
--      restaurantes en UNA transacción, dejando EXACTAMENTE la selección final y sin restos
--      de otra empresa (valida que los restaurantes son de la empresa). Solo service role.
--
-- Idempotente. Rollback: drop function public.nexo_set_contact_access(...);
--   alter table public.conv_contactos drop column tipo;

alter table public.conv_contactos add column if not exists tipo text;

alter table public.conv_contactos drop constraint if exists conv_contactos_tipo_check;
alter table public.conv_contactos
  add constraint conv_contactos_tipo_check
  check (tipo is null or tipo in ('direccion', 'operaciones', 'supervisor', 'responsable_marca', 'responsable_restaurante', 'otro'));

comment on column public.conv_contactos.tipo is
  'Tipo DESCRIPTIVO del contacto (dirección, operaciones, supervisor…). No decide permisos: salen de conv_contacto_empresas / conv_contacto_restaurantes.';

create or replace function public.nexo_set_contact_access(
  p_contacto_id uuid,
  p_nombre text,
  p_tipo text,
  p_empresa_id bigint,
  p_todos boolean,
  p_restaurante_ids bigint[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_todos boolean := coalesce(p_todos, false);
  v_restaurantes bigint[] := coalesce(array(select distinct x from unnest(p_restaurante_ids) x where x is not null), '{}');
begin
  perform 1 from public.conv_contactos where id = p_contacto_id for update;
  if not found then
    raise exception 'contacto no encontrado' using errcode = 'P0002';
  end if;

  if p_tipo is not null and p_tipo not in ('direccion', 'operaciones', 'supervisor', 'responsable_marca', 'responsable_restaurante', 'otro') then
    raise exception 'tipo no válido' using errcode = '22023';
  end if;

  if p_empresa_id is not null then
    if not exists (select 1 from public.empresas where id = p_empresa_id) then
      raise exception 'empresa no válida' using errcode = '22023';
    end if;
    -- Con una selección explícita, cada restaurante debe ser de la empresa elegida.
    if not v_todos and exists (
      select 1 from unnest(v_restaurantes) r
      where not exists (select 1 from public.restaurantes x where x.id = r and x.empresa_id = p_empresa_id)
    ) then
      raise exception 'restaurante de otra empresa o inexistente' using errcode = '22023';
    end if;
  end if;

  update public.conv_contactos
     set nombre = nullif(btrim(p_nombre), ''), tipo = p_tipo, updated_at = now()
   where id = p_contacto_id;

  -- Restaurantes: solo los de la selección final; con "todos" no se guarda ninguno
  -- (los de otra empresa se quitan siempre, antes que su empresa por las claves foráneas).
  delete from public.conv_contacto_restaurantes
   where contacto_id = p_contacto_id
     and (p_empresa_id is null or v_todos or empresa_id <> p_empresa_id or restaurante_id <> all (v_restaurantes));

  -- Empresa: exactamente la elegida (ninguna si no hay empresa → sin acceso).
  delete from public.conv_contacto_empresas
   where contacto_id = p_contacto_id
     and (p_empresa_id is null or empresa_id <> p_empresa_id);

  if p_empresa_id is not null then
    insert into public.conv_contacto_empresas (contacto_id, empresa_id, todos_restaurantes)
    values (p_contacto_id, p_empresa_id, v_todos)
    on conflict (contacto_id, empresa_id)
    do update set todos_restaurantes = excluded.todos_restaurantes, updated_at = now();

    if not v_todos then
      insert into public.conv_contacto_restaurantes (contacto_id, restaurante_id, empresa_id)
      select p_contacto_id, r, p_empresa_id from unnest(v_restaurantes) r
      on conflict (contacto_id, restaurante_id) do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.nexo_set_contact_access(uuid, text, text, bigint, boolean, bigint[]) from public, anon, authenticated;
grant execute on function public.nexo_set_contact_access(uuid, text, text, bigint, boolean, bigint[]) to service_role;

comment on function public.nexo_set_contact_access(uuid, text, text, bigint, boolean, bigint[]) is
  '[CONVERSATIONS] Cambia nombre, tipo, empresa, todos_restaurantes y selección de restaurantes de un contacto de WhatsApp en una transacción (selección final exacta, validada contra su empresa). Solo service role.';
