-- Canonical reputation foundation.
-- One deduplicated review stream in Supabase feeds period KPIs, daily charts,
-- motive aggregates and per-review rating impact.

create or replace function public.nexo_canonical_reviews(
  p_start date default null,
  p_end date default null,
  p_restaurant_ids bigint[] default null
)
returns table (
  id bigint,
  review_id text,
  restaurante_id bigint,
  estrellas integer,
  comentario text,
  autor text,
  original_ts timestamp without time zone,
  activity_date date
)
language sql
stable
set search_path = public
as $function$
with scoped_restaurants as (
  select r.id
  from public.restaurantes r
  where r.activo = true
    and (p_restaurant_ids is null or r.id = any(p_restaurant_ids))
),
raw_reviews as (
  select
    s.id,
    s.review_id,
    s.restaurante_id,
    s.estrellas,
    s.comentario,
    s.autor,
    coalesce(s.fecha_resena, s.created_at) as original_ts,
    coalesce(s.fecha_resena, s.created_at)::date as original_date,
    case
      when s.editada is true and s.fecha_ultima_edicion is not null
        then (s.fecha_ultima_edicion at time zone 'Europe/Madrid')::date
      else coalesce(s.fecha_resena, s.created_at)::date
    end as activity_date,
    nullif(btrim(s.review_id), '') as normalized_review_id,
    lower(regexp_replace(btrim(coalesce(s.restaurante_nombre, '')), '\s+', ' ', 'g')) as restaurant_name_norm,
    lower(regexp_replace(btrim(coalesce(s.autor, '')), '\s+', ' ', 'g')) as author_norm,
    lower(regexp_replace(btrim(coalesce(s.comentario, '')), '\s+', ' ', 'g')) as comment_norm
  from public.resenas s
  join scoped_restaurants sr on sr.id = s.restaurante_id
  where (
    p_start is null
    or (
      case
        when s.editada is true and s.fecha_ultima_edicion is not null
          then (s.fecha_ultima_edicion at time zone 'Europe/Madrid')::date
        else coalesce(s.fecha_resena, s.created_at)::date
      end
    ) >= p_start
  )
  and (
    p_end is null
    or (
      case
        when s.editada is true and s.fecha_ultima_edicion is not null
          then (s.fecha_ultima_edicion at time zone 'Europe/Madrid')::date
        else coalesce(s.fecha_resena, s.created_at)::date
      end
    ) <= p_end
  )
),
dedupe_review_id as (
  select *
  from (
    select
      rr.*,
      row_number() over (
        partition by
          case
            when rr.normalized_review_id is not null
              then 'review_id:' || rr.normalized_review_id
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
            when d.comment_norm = '' and d.author_norm = ''
              then 'row_id:' || d.id::text
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
select
  d.id,
  d.review_id,
  d.restaurante_id,
  d.estrellas,
  d.comentario,
  d.autor,
  d.original_ts,
  d.activity_date
from dedupe_content d;
$function$;

revoke all on function public.nexo_canonical_reviews(date,date,bigint[]) from public;
revoke all on function public.nexo_canonical_reviews(date,date,bigint[]) from anon;
revoke all on function public.nexo_canonical_reviews(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_canonical_reviews(date,date,bigint[]) to service_role;

create or replace function public.nexo_reputation_period_metrics(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  restaurante_id bigint,
  total_resenas bigint,
  rating_sum numeric,
  media_exacta numeric,
  positivas bigint,
  neutras bigint,
  negativas bigint,
  atencion bigint,
  stars_1 bigint,
  stars_2 bigint,
  stars_3 bigint,
  stars_4 bigint,
  stars_5 bigint,
  ultima_resena timestamptz,
  operational_status text,
  source text,
  network_total_resenas bigint,
  network_rating_sum numeric,
  network_media_exacta numeric,
  network_positivas bigint,
  network_neutras bigint,
  network_negativas bigint,
  network_atencion bigint,
  network_total_restaurantes bigint,
  network_positive_pct numeric,
  network_negative_pct numeric,
  network_ultima_resena timestamptz
)
language sql
stable
set search_path = public
as $function$
with params as (
  select least(p_start,p_end) as start_date,
         greatest(p_start,p_end) as end_date
),
scoped_restaurants as (
  select r.id
  from public.restaurantes r
  where r.activo = true
    and (p_restaurant_ids is null or r.id = any(p_restaurant_ids))
),
canonical as (
  select c.*
  from params p
  cross join lateral public.nexo_canonical_reviews(
    p.start_date,
    p.end_date,
    p_restaurant_ids
  ) c
),
per_review as (
  select
    c.restaurante_id,
    count(*)::bigint as total_resenas,
    coalesce(sum(c.estrellas),0)::numeric as rating_sum,
    count(*) filter(where c.estrellas >= 4)::bigint as positivas,
    count(*) filter(where c.estrellas = 3)::bigint as neutras,
    count(*) filter(where c.estrellas <= 2)::bigint as negativas,
    count(*) filter(where c.estrellas <= 3)::bigint as atencion,
    count(*) filter(where c.estrellas = 1)::bigint as stars_1,
    count(*) filter(where c.estrellas = 2)::bigint as stars_2,
    count(*) filter(where c.estrellas = 3)::bigint as stars_3,
    count(*) filter(where c.estrellas = 4)::bigint as stars_4,
    count(*) filter(where c.estrellas >= 5)::bigint as stars_5,
    max(c.original_ts at time zone 'Europe/Madrid') as ultima_resena
  from canonical c
  group by c.restaurante_id
),
per_restaurant as (
  select
    sr.id as restaurante_id,
    coalesce(pr.total_resenas,0)::bigint as total_resenas,
    coalesce(pr.rating_sum,0)::numeric as rating_sum,
    coalesce(pr.positivas,0)::bigint as positivas,
    coalesce(pr.neutras,0)::bigint as neutras,
    coalesce(pr.negativas,0)::bigint as negativas,
    coalesce(pr.atencion,0)::bigint as atencion,
    coalesce(pr.stars_1,0)::bigint as stars_1,
    coalesce(pr.stars_2,0)::bigint as stars_2,
    coalesce(pr.stars_3,0)::bigint as stars_3,
    coalesce(pr.stars_4,0)::bigint as stars_4,
    coalesce(pr.stars_5,0)::bigint as stars_5,
    pr.ultima_resena,
    case
      when coalesce(pr.total_resenas,0) = 0 then 0::numeric
      else pr.rating_sum / pr.total_resenas
    end as media_exacta,
    case
      when coalesce(pr.total_resenas,0) = 0 then 'watch'
      when (pr.rating_sum / pr.total_resenas) >= 4.4 then 'on_target'
      when (pr.rating_sum / pr.total_resenas) >= 4.0 then 'watch'
      else 'critical'
    end as operational_status
  from scoped_restaurants sr
  left join per_review pr on pr.restaurante_id = sr.id
),
network as (
  select
    coalesce(sum(pr.total_resenas),0)::bigint as total_resenas,
    coalesce(sum(pr.rating_sum),0)::numeric as rating_sum,
    coalesce(sum(pr.positivas),0)::bigint as positivas,
    coalesce(sum(pr.neutras),0)::bigint as neutras,
    coalesce(sum(pr.negativas),0)::bigint as negativas,
    coalesce(sum(pr.atencion),0)::bigint as atencion,
    count(*)::bigint as total_restaurantes,
    max(pr.ultima_resena) as ultima_resena
  from per_restaurant pr
)
select
  pr.restaurante_id,
  pr.total_resenas,
  pr.rating_sum,
  pr.media_exacta,
  pr.positivas,
  pr.neutras,
  pr.negativas,
  pr.atencion,
  pr.stars_1,
  pr.stars_2,
  pr.stars_3,
  pr.stars_4,
  pr.stars_5,
  pr.ultima_resena,
  pr.operational_status,
  case when n.total_resenas > 0 then 'resenas' else 'empty' end as source,
  n.total_resenas as network_total_resenas,
  n.rating_sum as network_rating_sum,
  case when n.total_resenas = 0 then 0::numeric else n.rating_sum/n.total_resenas end as network_media_exacta,
  n.positivas as network_positivas,
  n.neutras as network_neutras,
  n.negativas as network_negativas,
  n.atencion as network_atencion,
  n.total_restaurantes as network_total_restaurantes,
  case when n.total_resenas = 0 then 0::numeric else (n.positivas::numeric/n.total_resenas)*100 end as network_positive_pct,
  case when n.total_resenas = 0 then 0::numeric else (n.negativas::numeric/n.total_resenas)*100 end as network_negative_pct,
  n.ultima_resena as network_ultima_resena
from per_restaurant pr
cross join network n
order by pr.restaurante_id;
$function$;

revoke all on function public.nexo_reputation_period_metrics(date,date,bigint[]) from public;
revoke all on function public.nexo_reputation_period_metrics(date,date,bigint[]) from anon;
revoke all on function public.nexo_reputation_period_metrics(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_reputation_period_metrics(date,date,bigint[]) to service_role;

create or replace function public.nexo_reputation_daily_metrics(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  fecha date,
  restaurante_id bigint,
  total_resenas bigint,
  rating_sum numeric,
  media_exacta numeric,
  positivas bigint,
  neutras bigint,
  negativas bigint,
  atencion bigint
)
language sql
stable
set search_path = public
as $function$
select
  c.activity_date as fecha,
  c.restaurante_id,
  count(*)::bigint as total_resenas,
  sum(c.estrellas)::numeric as rating_sum,
  avg(c.estrellas)::numeric as media_exacta,
  count(*) filter(where c.estrellas >= 4)::bigint as positivas,
  count(*) filter(where c.estrellas = 3)::bigint as neutras,
  count(*) filter(where c.estrellas <= 2)::bigint as negativas,
  count(*) filter(where c.estrellas <= 3)::bigint as atencion
from public.nexo_canonical_reviews(
  least(p_start,p_end),
  greatest(p_start,p_end),
  p_restaurant_ids
) c
group by c.activity_date,c.restaurante_id
order by c.activity_date,c.restaurante_id;
$function$;

revoke all on function public.nexo_reputation_daily_metrics(date,date,bigint[]) from public;
revoke all on function public.nexo_reputation_daily_metrics(date,date,bigint[]) from anon;
revoke all on function public.nexo_reputation_daily_metrics(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_reputation_daily_metrics(date,date,bigint[]) to service_role;

create or replace function public.nexo_review_rating_impacts(
  p_resena_ids bigint[]
)
returns table (
  resena_id bigint,
  review_id text,
  restaurante_id bigint,
  media_before numeric,
  media_after numeric,
  impact numeric,
  reviews_before bigint,
  reviews_after bigint
)
language sql
stable
set search_path = public
as $function$
with targets as (
  select distinct s.id,s.restaurante_id
  from public.resenas s
  where s.id = any(p_resena_ids)
    and s.restaurante_id is not null
),
restaurant_ids as (
  select array_agg(distinct t.restaurante_id)::bigint[] as ids
  from targets t
),
canonical as (
  select c.*
  from restaurant_ids r
  cross join lateral public.nexo_canonical_reviews(null,null,r.ids) c
),
windowed as (
  select
    c.*,
    count(*) over (
      partition by c.restaurante_id
      order by c.original_ts,c.id
      rows between unbounded preceding and 1 preceding
    )::bigint as reviews_before,
    count(*) over (
      partition by c.restaurante_id
      order by c.original_ts,c.id
      rows between unbounded preceding and current row
    )::bigint as reviews_after,
    sum(c.estrellas) over (
      partition by c.restaurante_id
      order by c.original_ts,c.id
      rows between unbounded preceding and 1 preceding
    )::numeric as sum_before,
    sum(c.estrellas) over (
      partition by c.restaurante_id
      order by c.original_ts,c.id
      rows between unbounded preceding and current row
    )::numeric as sum_after
  from canonical c
)
select
  w.id as resena_id,
  w.review_id,
  w.restaurante_id,
  case when w.reviews_before = 0 then null else w.sum_before/w.reviews_before end as media_before,
  case when w.reviews_after = 0 then null else w.sum_after/w.reviews_after end as media_after,
  case
    when w.reviews_before = 0 or w.reviews_after = 0 then 0::numeric
    else (w.sum_after/w.reviews_after) - (w.sum_before/w.reviews_before)
  end as impact,
  w.reviews_before,
  w.reviews_after
from windowed w
where w.id = any(p_resena_ids)
order by w.id;
$function$;

revoke all on function public.nexo_review_rating_impacts(bigint[]) from public;
revoke all on function public.nexo_review_rating_impacts(bigint[]) from anon;
revoke all on function public.nexo_review_rating_impacts(bigint[]) from authenticated;
grant execute on function public.nexo_review_rating_impacts(bigint[]) to service_role;

create or replace function public.nexo_reputation_motives_period(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  categoria text,
  motivo_count bigint,
  total_categorizadas bigint,
  percent numeric
)
language sql
stable
set search_path = public
as $function$
with categorized as (
  select
    upper(btrim(rm.categoria)) as categoria
  from public.nexo_canonical_reviews(
    least(p_start,p_end),
    greatest(p_start,p_end),
    p_restaurant_ids
  ) c
  join public.resena_motivos rm
    on rm.review_id = c.review_id
  where c.estrellas <= 3
    and rm.categoria is not null
    and btrim(rm.categoria) <> ''
),
counts as (
  select categoria,count(*)::bigint as motivo_count
  from categorized
  group by categoria
),
total as (
  select count(*)::bigint as total_categorizadas
  from categorized
)
select
  c.categoria,
  c.motivo_count,
  t.total_categorizadas,
  case
    when t.total_categorizadas = 0 then 0::numeric
    else (c.motivo_count::numeric/t.total_categorizadas)*100
  end as percent
from counts c
cross join total t
order by c.motivo_count desc,c.categoria;
$function$;

revoke all on function public.nexo_reputation_motives_period(date,date,bigint[]) from public;
revoke all on function public.nexo_reputation_motives_period(date,date,bigint[]) from anon;
revoke all on function public.nexo_reputation_motives_period(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_reputation_motives_period(date,date,bigint[]) to service_role;

comment on function public.nexo_canonical_reviews(date,date,bigint[]) is
  'Single canonical deduplicated review stream used by all Nexo reputation calculations.';
comment on function public.nexo_reputation_period_metrics(date,date,bigint[]) is
  'Official period reputation KPI calculation. No legacy KPI table fallback.';
comment on function public.nexo_reputation_daily_metrics(date,date,bigint[]) is
  'Official daily reputation series derived from the canonical review stream.';
comment on function public.nexo_review_rating_impacts(bigint[]) is
  'Official before/after cumulative rating impact for selected canonical reviews.';
comment on function public.nexo_reputation_motives_period(date,date,bigint[]) is
  'Official period motive distribution for attention reviews (1-3 stars).';
