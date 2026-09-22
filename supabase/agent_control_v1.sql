-- Agent control center V1.
-- Additive migration: keeps current Make bot compatibility intact.

alter table public.nexo_bot_accesos
  add column if not exists id uuid default gen_random_uuid();

update public.nexo_bot_accesos
set id = gen_random_uuid()
where id is null;

alter table public.nexo_bot_accesos
  alter column id set not null;

create unique index if not exists nexo_bot_accesos_id_key
  on public.nexo_bot_accesos(id);

alter table public.nexo_bot_accesos
  add column if not exists modo text not null default 'piloto',
  add column if not exists resumen_diario boolean not null default false,
  add column if not exists resumen_hora time without time zone not null default '09:00',
  add column if not exists timezone text not null default 'Europe/Madrid',
  add column if not exists actualizado_en timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexo_bot_accesos_modo_check'
  ) then
    alter table public.nexo_bot_accesos
      add constraint nexo_bot_accesos_modo_check
      check (modo in ('piloto','activo','pausado'));
  end if;
end
$$;

comment on column public.nexo_bot_accesos.id is
  'Stable internal agent access id used by Nexo Control; phone remains the current Make lookup key.';
comment on column public.nexo_bot_accesos.modo is
  'Operational rollout state: piloto, activo or pausado.';
comment on column public.nexo_bot_accesos.resumen_diario is
  'Configuration flag for the future scheduled supervisor summary.';
comment on column public.nexo_bot_accesos.resumen_hora is
  'Local scheduled summary time; delivery remains handled by the agent orchestration layer.';
