-- SEC-006 — Límite de frecuencia compartido entre instancias serverless (Vercel).
--
-- `POST /api/generate-negative-review-image` arranca Chromium en cada llamada. Un contador en memoria se resetea
-- entre instancias, así que el contador vive aquí: una fila por (cubo, ventana) incrementada de forma ATÓMICA por
-- `nexo_rate_limit_hit` (ventana fija). El cubo lo construye siempre el servidor (p. ej. el id del usuario
-- autenticado). Solo `service_role` puede usarlo: la tabla tiene RLS sin políticas y ningún privilegio para
-- `anon`/`authenticated`; la función es SECURITY INVOKER con search_path fijo.
--
-- Hasta que se aplique esta migración, la aplicación usa un contador en memoria por instancia como respaldo
-- (menos preciso, pero con límite). Idempotente. Reversible con `sec_006_rate_limit_rollback.sql`.
-- Ventana fija: en el cambio de ventana un usuario puede hacer hasta 2x el límite en un instante. Es aceptable aquí.

begin;

create table if not exists public.api_rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);

create index if not exists api_rate_limits_window_start_idx on public.api_rate_limits (window_start);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.nexo_rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, current_hits integer, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_bucket is null or length(p_bucket) = 0 or length(p_bucket) > 200
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Limpieza oportunista de ventanas antiguas (barata gracias al índice).
  if random() < 0.02 then
    delete from public.api_rate_limits where window_start < now() - interval '1 day';
  end if;

  return query
    select v_hits <= p_limit,
           v_hits,
           greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::integer);
end;
$$;

revoke execute on function public.nexo_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.nexo_rate_limit_hit(text, integer, integer) to service_role;

commit;
