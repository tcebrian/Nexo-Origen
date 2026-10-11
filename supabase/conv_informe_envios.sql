-- NEXO — Informe diario por WhatsApp: ventana horaria + envíos con FOTO (snapshot).
--
-- 1) `nexo_window_reviews` y `nexo_reputation_window_metrics`: reseñas y métricas de una VENTANA HORARIA
--    [p_start, p_end) en hora de calendario de Madrid. Aplican la MISMA deduplicación que la función
--    canónica por días (`nexo_reputation_period_metrics`): por review_id y por contenido. El motor por días
--    no se toca: sigue sirviendo a los informes semanales, mensuales y trimestrales.
-- 2) `conv_informe_envios`: un registro por (contacto, día del slot, plantilla). Guarda el periodo, el
--    snapshot JSONB con los resultados calculados a las 09:00 y la asociación con el mensaje de WhatsApp
--    (wamid) para que "Ver informe" muestre EXACTAMENTE ese informe, sin recalcular.
--
-- Los instantes se manejan como "hora de pared" de Madrid (`timestamp` sin zona), que es cómo está
-- guardada `resenas.fecha_resena`; las reseñas editadas (`timestamptz`) se pasan a hora de pared de Madrid.
-- Aditiva e idempotente.

-- 1) Reseñas deduplicadas de la ventana -------------------------------------------------------------------
create or replace function public.nexo_window_reviews(
  p_start timestamp,
  p_end timestamp,
  p_restaurant_ids bigint[]
)
returns table (
  restaurante_id bigint,
  id bigint,
  review_id text,
  estrellas integer,
  comentario text,
  activity_wall timestamp
)
language sql
stable
set search_path = public
as $function$
with raw_reviews as (
  select
    s.id,
    s.restaurante_id,
    s.estrellas,
    s.comentario,
    nullif(btrim(s.review_id), '') as normalized_review_id,
    s.review_id,
    coalesce(s.fecha_resena, s.created_at) as original_ts,
    coalesce(s.fecha_resena, s.created_at)::date as original_date,
    case
      when s.editada is true and s.fecha_ultima_edicion is not null
        then s.fecha_ultima_edicion at time zone 'Europe/Madrid'
      else coalesce(s.fecha_resena, s.created_at)
    end as activity_wall,
    lower(regexp_replace(btrim(coalesce(s.restaurante_nombre, '')), '\s+', ' ', 'g')) as restaurant_name_norm,
    lower(regexp_replace(btrim(coalesce(s.autor, '')), '\s+', ' ', 'g')) as author_norm,
    lower(regexp_replace(btrim(coalesce(s.comentario, '')), '\s+', ' ', 'g')) as comment_norm
  from public.resenas s
  join public.restaurantes r on r.id = s.restaurante_id and r.activo = true
  where s.restaurante_id = any(p_restaurant_ids)
    and (
      case
        when s.editada is true and s.fecha_ultima_edicion is not null
          then s.fecha_ultima_edicion at time zone 'Europe/Madrid'
        else coalesce(s.fecha_resena, s.created_at)
      end
    ) >= p_start
    and (
      case
        when s.editada is true and s.fecha_ultima_edicion is not null
          then s.fecha_ultima_edicion at time zone 'Europe/Madrid'
        else coalesce(s.fecha_resena, s.created_at)
      end
    ) < p_end
),
dedupe_review_id as (
  select *
  from (
    select
      rr.*,
      row_number() over (
        partition by
          case
            when rr.normalized_review_id is not null then 'review_id:' || rr.normalized_review_id
            else 'row_id:' || rr.id::text
          end
        order by rr.original_ts desc nulls last, rr.id desc
      ) as rn
    from raw_reviews rr
  ) ranked
  where rn = 1
),
dedupe_content as (
  select *
  from (
    select
      d.*,
      row_number() over (
        partition by
          case
            when d.comment_norm = '' and d.author_norm = '' then 'row_id:' || d.id::text
            else
              'content:' ||
              coalesce(d.restaurante_id::text, '0') || ':' ||
              d.restaurant_name_norm || ':' ||
              coalesce(to_char(d.original_date, 'YYYY-MM-DD'), '') || ':' ||
              d.author_norm || ':' ||
              d.estrellas::text || ':' ||
              d.comment_norm
          end
        order by
          (d.normalized_review_id is not null) desc,
          d.original_ts desc nulls last,
          d.id desc
      ) as rn_content
    from dedupe_review_id d
  ) ranked
  where rn_content = 1
)
select d.restaurante_id, d.id, d.review_id, d.estrellas::integer, d.comentario, d.activity_wall
from dedupe_content d;
$function$;

comment on function public.nexo_window_reviews(timestamp, timestamp, bigint[]) is
  'Reseñas deduplicadas con actividad en [p_start, p_end), hora de pared de Madrid. Misma deduplicación que nexo_reputation_period_metrics.';

-- 2) Métricas de la ventana (agregado de las reseñas anteriores) ------------------------------------------
create or replace function public.nexo_reputation_window_metrics(
  p_start timestamp,
  p_end timestamp,
  p_restaurant_ids bigint[]
)
returns table (
  restaurante_id bigint,
  total_resenas bigint,
  rating_sum numeric,
  media_exacta numeric,
  positivas bigint,
  neutras bigint,
  negativas bigint
)
language sql
stable
set search_path = public
as $function$
select
  w.restaurante_id,
  count(*)::bigint,
  coalesce(sum(w.estrellas), 0)::numeric,
  case when count(*) > 0 then sum(w.estrellas)::numeric / count(*) else 0 end,
  count(*) filter (where w.estrellas >= 4)::bigint,
  count(*) filter (where w.estrellas = 3)::bigint,
  count(*) filter (where w.estrellas <= 2)::bigint
from public.nexo_window_reviews(p_start, p_end, p_restaurant_ids) w
group by w.restaurante_id;
$function$;

comment on function public.nexo_reputation_window_metrics(timestamp, timestamp, bigint[]) is
  'Métricas por restaurante en [p_start, p_end), hora de pared de Madrid. Sin filas = 0 reseñas.';

-- 3) Envíos del informe diario con snapshot ----------------------------------------------------------------
create table if not exists public.conv_informe_envios (
  id               uuid primary key default gen_random_uuid(),
  contacto_id      uuid not null references public.conv_contactos(id) on delete cascade,
  conversacion_id  uuid references public.conv_conversaciones(id) on delete set null,
  -- Mensaje de la plantilla enviada y su wamid (para localizar este informe cuando se pulsa "Ver informe").
  mensaje_id       uuid references public.conv_mensajes(id) on delete set null,
  template_wamid   text,
  template         text not null default 'informe_diario',
  -- Día de calendario (Madrid) del slot de las 09:00.
  slot_date        date not null,
  kind             text not null check (kind in ('WEEKLY_CLOSURE', 'WEEK_TO_DATE')),
  -- Ventana [period_start, period_end) en hora de pared de Madrid.
  period_start     timestamp not null,
  period_end       timestamp not null,
  -- Foto de los resultados calculados en el slot: el informe se renderiza desde aquí, sin recalcular.
  snapshot         jsonb,
  status           text not null default 'reserved' check (status in ('reserved', 'sent', 'failed')),
  error_code       text,
  error_reason     text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  -- Primer y último "Ver informe", nº de veces y si alguna se resolvió por respaldo (sin context.id).
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  view_count       integer not null default 0,
  view_fallback_used boolean not null default false,
  constraint conv_informe_envios_contacto_slot_template_key unique (contacto_id, slot_date, template),
  check (period_end > period_start)
);

create index if not exists conv_informe_envios_wamid_idx on public.conv_informe_envios (template_wamid)
  where template_wamid is not null;
create index if not exists conv_informe_envios_contacto_created_idx on public.conv_informe_envios (contacto_id, created_at desc);

alter table public.conv_informe_envios enable row level security;

comment on table public.conv_informe_envios is
  'Un informe diario enviado por contacto y slot de las 09:00 (Madrid), con el snapshot de sus resultados y su wamid.';
