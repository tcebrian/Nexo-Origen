-- Nexo Origen · Informes PNG de red: TODO el cálculo en Supabase.
--
-- Hasta ahora las imágenes de informe combinaban dos sitios: las cifras venían
-- de nexo_reputation_period_metrics, pero el objetivo (4,4), los estados
-- (sobre objetivo / vigilancia / fuera), el reparto de motivos, los
-- porcentajes y la media global se calculaban en TypeScript, y el objetivo ni
-- siquiera se leía de marcas.objetivo_media (Vault tiene 4,7).
--
-- Esta función devuelve el informe completo ya calculado; la aplicación solo
-- decide qué restaurantes componen cada informe y da formato al resultado.
--
--   · Flujo de reseñas: nexo_canonical_reviews (deduplicado, restaurantes
--     activos, fecha de actividad = edición si la reseña fue editada).
--   · Objetivo: marcas.objetivo_media de cada restaurante (4,4 si no hay).
--   · Estado: total = 0 → no_reviews · media ≥ objetivo → on_target ·
--     media ≥ p_watch_threshold → watch · si no → risk.
--   · Positivas 4-5★ · neutras 3★ · negativas 1-2★ (KPI). El reparto de
--     motivos cuenta las reseñas de hasta p_negative_max_stars estrellas
--     (3 = reseñas de atención; 2 = solo negativas) que tienen motivo en
--     resena_motivos; máx. 6 motivos, el resto se suma en OTRO; los
--     porcentajes tienen 1 decimal y suman exactamente 100. En empates se
--     prefieren los motivos reales a SIN_MOTIVO / VALORACION_INCOHERENTE /
--     NO_OPERATIVO (misma convención que las vistas motivos_*).
--   · Si el grupo mezcla objetivos distintos, target_average = el mayor.
--
-- Solo servidor (service role). Sin escritura: STABLE.
-- Rollback: drop function public.nexo_network_summary_payload(date, date, bigint[], integer, numeric);

create or replace function public.nexo_network_summary_payload(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null,
  p_negative_max_stars integer default 3,
  p_watch_threshold numeric default 4.0
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
with params as (
  select least(p_start, p_end) as s,
         greatest(p_start, p_end) as e,
         greatest(least(coalesce(p_negative_max_stars, 3), 3), 1) as max_stars
),
scope as (
  select r.id as restaurante_id,
         r.nombre as restaurante,
         coalesce(r.ciudad, '') as ciudad,
         coalesce(m.nombre, '') as marca,
         coalesce(m.objetivo_media, 4.4) as target
  from public.restaurantes r
  left join public.marcas m on m.id = r.marca_id
  where coalesce(r.activo, true) = true
    and (p_restaurant_ids is null or r.id = any (p_restaurant_ids))
),
reviews as (
  select c.review_id, c.restaurante_id, c.estrellas
  from params p
  cross join lateral public.nexo_canonical_reviews(p.s, p.e, p_restaurant_ids) c
),
per_loc as (
  select s.restaurante_id, s.restaurante, s.ciudad, s.marca, s.target,
         count(v.estrellas)::bigint as total,
         coalesce(sum(v.estrellas), 0)::numeric as rating_sum,
         count(*) filter (where v.estrellas >= 4)::bigint as positive,
         count(*) filter (where v.estrellas = 3)::bigint as neutral,
         count(*) filter (where v.estrellas <= 2)::bigint as negative
  from scope s
  left join reviews v on v.restaurante_id = s.restaurante_id
  group by s.restaurante_id, s.restaurante, s.ciudad, s.marca, s.target
),
neg as (
  select v.restaurante_id, upper(btrim(rm.categoria)) as categoria
  from reviews v
  join public.resena_motivos rm on rm.review_id = v.review_id
  cross join params p
  where v.estrellas <= p.max_stars
    and nullif(btrim(rm.categoria), '') is not null
),
loc_motive as (
  select distinct on (x.restaurante_id) x.restaurante_id, x.categoria, x.n
  from (
    select restaurante_id, categoria, count(*)::bigint as n
    from neg
    group by restaurante_id, categoria
  ) x
  order by x.restaurante_id, x.n desc,
           (x.categoria in ('SIN_MOTIVO', 'VALORACION_INCOHERENTE', 'NO_OPERATIVO')), x.categoria
),
locs as (
  select l.*,
         case when l.total > 0 then l.rating_sum / l.total end as media,
         case
           when l.total = 0 then 'no_reviews'
           when l.rating_sum / l.total >= l.target then 'on_target'
           when l.rating_sum / l.total >= p_watch_threshold then 'watch'
           else 'risk'
         end as status,
         lm.categoria as top_motive
  from per_loc l
  left join loc_motive lm on lm.restaurante_id = l.restaurante_id
),
cat_counts as (
  select categoria, count(*)::bigint as n from neg group by categoria
),
ranked as (
  select categoria, n,
         row_number() over (order by n desc,
           (categoria in ('SIN_MOTIVO', 'VALORACION_INCOHERENTE', 'NO_OPERATIVO')), categoria) as rk,
         count(*) over () as ncat
  from cat_counts
),
rest as (
  select coalesce(sum(n), 0)::bigint as n from ranked where ncat > 6 and rk > 5
),
merged as (
  select k.categoria,
         k.n + case when k.categoria = 'OTRO' then (select n from rest) else 0 end as n
  from ranked k
  where k.ncat <= 6 or k.rk <= 5
  union all
  select 'OTRO', (select n from rest)
  where (select n from rest) > 0
    and not exists (
      select 1 from ranked k where (k.ncat <= 6 or k.rk <= 5) and k.categoria = 'OTRO'
    )
),
ordered as (
  select categoria, n,
         row_number() over (order by n desc,
           (categoria in ('SIN_MOTIVO', 'VALORACION_INCOHERENTE', 'NO_OPERATIVO')), categoria) as rn,
         count(*) over () as cnt,
         sum(n) over () as total_n
  from merged
),
pct as (
  select o.*,
         case when o.total_n = 0 then 0::numeric else round(o.n::numeric * 100 / o.total_n, 1) end as pct_raw
  from ordered o
),
reasons as (
  select categoria, n, rn,
         case
           when rn = cnt then round(
             100 - coalesce(sum(pct_raw) over (order by rn rows between unbounded preceding and 1 preceding), 0), 1)
           else pct_raw
         end as percent
  from pct
),
net as (
  select count(*)::bigint as locations,
         coalesce(sum(total), 0)::bigint as reviews,
         coalesce(sum(rating_sum), 0)::numeric as rating_sum,
         coalesce(sum(positive), 0)::bigint as positive,
         coalesce(sum(neutral), 0)::bigint as neutral,
         coalesce(sum(negative), 0)::bigint as negative,
         max(target) as target
  from per_loc
),
below as (
  select restaurante_id, restaurante, media
  from locs
  where status in ('watch', 'risk')
)
select jsonb_build_object(
  'period', (select jsonb_build_object('start', p.s, 'end', p.e) from params p),
  'target_average', (select target from net),
  'watch_threshold', p_watch_threshold,
  'negative_max_stars', (select max_stars from params),
  'totals', (
    select jsonb_build_object(
      'locations', n.locations,
      'reviews', n.reviews,
      'positive', n.positive,
      'neutral', n.neutral,
      'negative', n.negative,
      'positive_pct', case when n.reviews > 0 then round(n.positive::numeric * 100 / n.reviews, 1) else 0 end,
      'negative_pct', case when n.reviews > 0 then round(n.negative::numeric * 100 / n.reviews, 1) else 0 end,
      'weighted_average', case when n.reviews > 0 then round(n.rating_sum / n.reviews, 2) else 0 end,
      'below_target_count', (select count(*) from below)
    )
    from net n
  ),
  'below_target_locations', coalesce(
    (select jsonb_agg(b.restaurante order by b.media, b.restaurante_id) from below b), '[]'::jsonb),
  'cities_label', coalesce((
    select string_agg(c.city, ' + ' order by c.city)
    from (select distinct upper(btrim(ciudad)) as city from scope where btrim(ciudad) <> '') c
  ), ''),
  'locations', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'restaurante_id', l.restaurante_id,
        'restaurante', l.restaurante,
        'ciudad', l.ciudad,
        'marca', l.marca,
        'target', l.target,
        'rating', l.media,
        'reviews', l.total,
        'positive', l.positive,
        'neutral', l.neutral,
        'negative', l.negative,
        'status', l.status,
        'top_negative_categoria', l.top_motive
      )
      order by l.media desc nulls last, l.restaurante_id)
    from locs l
  ), '[]'::jsonb),
  'negative_reasons', coalesce((
    select jsonb_agg(
      jsonb_build_object('categoria', f.categoria, 'count', f.n, 'percent', f.percent)
      order by f.rn)
    from reasons f
  ), '[]'::jsonb),
  'negative_reasons_total', coalesce((select sum(n) from reasons), 0)
);
$function$;

revoke all on function public.nexo_network_summary_payload(date, date, bigint[], integer, numeric)
  from public, anon, authenticated;
grant execute on function public.nexo_network_summary_payload(date, date, bigint[], integer, numeric)
  to service_role;

comment on function public.nexo_network_summary_payload(date, date, bigint[], integer, numeric) is
  '[REPUTATION|produccion] Informe de red completo ya calculado (totales, media ponderada, objetivo por marca, estado y motivo principal por local, reparto de motivos negativos). ORIGEN: nexo_canonical_reviews + resena_motivos + marcas.objetivo_media. USO: imágenes PNG de informes (lib/reports/network-summary). La aplicación solo elige qué restaurantes entran y da formato; no recalcula nada.';
