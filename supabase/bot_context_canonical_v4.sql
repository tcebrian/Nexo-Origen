-- Canonical context for WhatsApp.
-- Qualitative pattern analysis starts from nexo_canonical_reviews;
-- deterministic period KPIs come from nexo_reputation_period_metrics.

create or replace function public.nexo_bot_contexto_core_v4(
  p_phone text,
  p_request text
)
returns jsonb
language plpgsql
stable
set search_path=''
as $function$
declare
  q jsonb;
  base jsonb;
  extras jsonb := '{}'::jsonb;
  ids bigint[];
  d1 date;
  d2 date;
  cats jsonb := '[]'::jsonb;
  terms jsonb := '[]'::jsonb;
  cov jsonb := '{}'::jsonb;
  goals jsonb := '[]'::jsonb;
  months jsonb := '[]'::jsonb;
  msg text;
  it text;
  local_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if length(coalesce(p_request,''))>6000 then
    return jsonb_build_object('ok',false,'message','Consulta demasiado larga.');
  end if;

  begin
    q:=p_request::jsonb;
  exception when others then
    return jsonb_build_object('ok',false,'message','No he entendido la consulta.');
  end;

  it:=q->>'intent';

  -- Always validate identity/scope first.
  base:=public.nexo_bot_consulta_core_v4(
    p_phone,
    (q||jsonb_build_object('intent','summary','period','today'))::text
  );
  if coalesce(base->>'ok','false')<>'true' then return base; end if;

  if it='clarify' or q->>'period'='unspecified' then
    msg:=case q->>'missing'
      when 'restaurant' then '¿Qué restaurante quieres consultar?'
      when 'dates' then 'Dime la fecha exacta de inicio y fin (día/mes/año).'
      when 'restaurant_period' then '¿Qué restaurante quieres consultar y para qué periodo: esta semana u otro? Si es otro, dime las fechas de inicio y fin.'
      else '¿Quieres ver esta semana u otro periodo? Si es otro, dime las fechas exactas de inicio y fin, o el mes que quieres consultar.'
    end;
    return jsonb_build_object(
      'ok',true,
      'needs_clarification',true,
      'message',msg,
      'context',msg
    );
  end if;

  if it not in ('summary','comparison','negative','motives','ranking','patterns','objectives') then
    return public.nexo_bot_consulta_core_v4(p_phone,p_request);
  end if;

  base:=public.nexo_bot_consulta_core_v4(
    p_phone,
    (q||jsonb_build_object(
      'intent',
      case when it in ('patterns','objectives') then 'summary' else it end
    ))::text
  );

  if coalesce(base->>'ok','false')<>'true' then return base; end if;

  select array_agg(value::bigint)
    into ids
  from jsonb_array_elements_text(base->'restaurant_ids');

  d1:=(base->>'period_start')::date;
  d2:=(base->>'period_end')::date;

  if it in ('summary','comparison','negative','motives') then
    extras:=extras||jsonb_build_object(
      'motivos',
      public.nexo_bot_consulta_core_v4(
        p_phone,(q||'{"intent":"motives"}'::jsonb)::text
      )->'motives',
      'muestra_negativas',
      public.nexo_bot_consulta_core_v4(
        p_phone,(q||'{"intent":"negative"}'::jsonb)::text
      )->>'message'
    );
  end if;

  if it in ('patterns','motives') then
    with c as (
      select *
      from public.nexo_canonical_reviews(d1,d2,ids)
    )
    select jsonb_build_object(
      'total',count(*),
      'con_texto',count(*) filter(where nullif(trim(comentario),'') is not null),
      'negativas',count(*) filter(where estrellas<=2),
      'requieren_atencion',count(*) filter(where estrellas<=3),
      'clasificadas',count(*) filter(
        where exists(
          select 1 from public.resena_motivos m where m.review_id=c.review_id
        )
      ),
      'atencion_clasificada',count(*) filter(
        where estrellas<=3 and exists(
          select 1 from public.resena_motivos m where m.review_id=c.review_id
        )
      ),
      'primera_resena',min(activity_date),
      'ultima_resena',max(activity_date)
    )
    into cov
    from c;

    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
      into cats
    from (
      select
        c.restaurante_id,
        s.nombre,
        m.categoria,
        count(distinct c.review_id) as menciones,
        count(distinct date_trunc('week',c.activity_date::timestamp)) as semanas_distintas,
        count(distinct date_trunc('month',c.activity_date::timestamp)) as meses_distintos,
        min(c.activity_date) as primera,
        max(c.activity_date) as ultima
      from public.nexo_canonical_reviews(d1,d2,ids) c
      join public.resena_motivos m on m.review_id=c.review_id
      join public.restaurantes s on s.id=c.restaurante_id
      where c.estrellas<=3
        and m.categoria not in ('SIN_MOTIVO','OTRO','NO_OPERATIVO','VALORACION_INCOHERENTE')
      group by c.restaurante_id,s.nombre,m.categoria
      order by menciones desc
      limit 30
    ) x;

    with topics(topic,rx) as (
      values
        ('Tiempos','esper|lent|tarda|minutos|rapidez|rápid|rapid'),
        ('Atención','atenci[oó]n|trato|amab|personal|emplead'),
        ('Producto','calidad|fr[ií][oa]|caliente|sabor|crudo|quemad'),
        ('Limpieza','limpi|suci|higien'),
        ('Pedido','equivoc|incomplet|faltaba|faltaban|pedido incorrect'),
        ('Servicio a mesa','servicio.{0,15}mesa|servir.{0,15}mesa|lleva.{0,15}mesa'),
        ('AutoKing','autoking|auto king|drive|carril|coche')
    )
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
      into terms
    from (
      select
        c.restaurante_id,
        s.nombre,
        t.topic,
        count(*) as menciones,
        count(*) filter(where c.estrellas<=2) as en_negativas,
        count(*) filter(where c.estrellas=3) as en_neutras,
        count(*) filter(where c.estrellas>=4) as en_positivas,
        count(distinct date_trunc('week',c.activity_date::timestamp)) as semanas_distintas,
        min(c.activity_date) as primera,
        max(c.activity_date) as ultima
      from public.nexo_canonical_reviews(d1,d2,ids) c
      join topics t on coalesce(c.comentario,'') ~* t.rx
      join public.restaurantes s on s.id=c.restaurante_id
      group by c.restaurante_id,s.nombre,t.topic
      order by menciones desc
      limit 40
    ) x;

    extras:=extras||jsonb_build_object(
      'cobertura',cov,
      'patrones_atencion_clasificada',cats,
      'menciones_literales_todas_estrellas',terms,
      'metodo',
      'Todas las cuentas parten de nexo_canonical_reviews. Categorías registradas: reseñas 1–3★ clasificadas en resena_motivos. Menciones literales: búsqueda de términos en todos los textos canónicos del periodo; no equivale a queja ni demuestra sentimiento. Una reseña puede mencionar varios temas.',
      'muestra_negativas',
      public.nexo_bot_consulta_core_v4(
        p_phone,(q||'{"intent":"negative"}'::jsonb)::text
      )->>'message'
    );
  end if;

  if it in ('summary','comparison','objectives') then
    -- Closed natural weeks only. Facts are canonical/deduplicated.
    with restaurant_targets as (
      select
        r.id,
        r.nombre,
        coalesce(m.objetivo_media,4.4)::numeric as target
      from public.restaurantes r
      left join public.marcas m on m.id=r.marca_id
      where r.id=any(ids)
    ),
    week_grid as (
      select
        rt.id,
        rt.nombre,
        rt.target,
        gs::date as ws
      from restaurant_targets rt
      cross join lateral generate_series(
        date_trunc('week',d1::timestamp)
          + case
              when d1>date_trunc('week',d1::timestamp)::date
                then interval '7 days'
              else interval '0 days'
            end,
        least(
          date_trunc('week',d2::timestamp),
          date_trunc('week',local_today::timestamp)-interval '7 days'
        ),
        interval '7 days'
      ) gs
      where gs::date+6<=d2
    ),
    weekly as (
      select
        wg.id,
        wg.nombre,
        wg.target,
        wg.ws,
        count(c.id)::bigint as n,
        avg(c.estrellas)::numeric as av
      from week_grid wg
      left join public.nexo_canonical_reviews(d1,d2,ids) c
        on c.restaurante_id=wg.id
       and c.activity_date between wg.ws and wg.ws+6
      group by wg.id,wg.nombre,wg.target,wg.ws
    ),
    numbered as (
      select *,
        sum(case when n=0 or av>=target then 1 else 0 end)
        over(partition by id order by ws desc) as breaks
      from weekly
    ),
    result as (
      select
        id,
        nombre,
        max(target) as objetivo,
        count(*) as semanas_cerradas,
        count(*) filter(where n>0) as semanas_con_resenas,
        count(*) filter(where n=0) as semanas_sin_resenas,
        count(*) filter(where n>0 and av<target) as semanas_fuera_objetivo,
        count(*) filter(where breaks=0 and n>0 and av<target) as racha_al_final_periodo,
        min(ws) filter(where breaks=0 and n>0 and av<target) as inicio_racha,
        max(ws)+6 as ultima_semana_cerrada_fin,
        (
          select jsonb_agg(to_jsonb(z) order by z.inicio desc)
          from (
            select
              w2.ws as inicio,
              w2.ws+6 as fin,
              w2.n as resenas,
              case when w2.n>0 then round(w2.av,2) else null end as media,
              case
                when w2.n=0 then 'sin datos'
                when w2.av>=w2.target then 'cumple'
                else 'fuera'
              end as estado
            from weekly w2
            where w2.id=numbered.id
            order by w2.ws desc
            limit 8
          ) z
        ) as ultimas_8_semanas
      from numbered
      group by id,nombre
    )
    select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb)
      into goals
    from result;

    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
      into months
    from (
      select
        s.nombre,
        c.restaurante_id,
        date_trunc('month',c.activity_date::timestamp)::date as mes,
        count(*)::bigint as resenas,
        round(avg(c.estrellas)::numeric,2) as media,
        count(*) filter(where c.estrellas<=2)::bigint as negativas
      from public.nexo_canonical_reviews(d1,d2,ids) c
      join public.restaurantes s on s.id=c.restaurante_id
      group by s.nombre,c.restaurante_id,mes
      order by mes desc,s.nombre
      limit 120
    ) x;

    extras:=extras||jsonb_build_object(
      'objetivos_semanales',goals,
      'meses_en_periodo',months,
      'regla_racha',
      'Semanas de calendario lunes-domingo ya cerradas, calculadas sobre nexo_canonical_reviews. El objetivo sale de marcas.objetivo_media. Una semana sin reseñas corta la racha verificable.'
    );
  end if;

  return base||extras||jsonb_build_object(
    'intent',it,
    'context',jsonb_build_object(
      'metricas',base,
      'analisis',extras,
      'source','nexo_canonical_reviews+nexo_reputation_period_metrics'
    )::text
  );
end;
$function$;

create or replace function public.nexo_bot_contexto_v3(p_phone text,p_request text)
returns jsonb
language sql
stable
set search_path=''
as $function$
  select public.nexo_bot_contexto_core_v4(p_phone,p_request);
$function$;

revoke all on function public.nexo_bot_contexto_core_v4(text,text) from public,anon,authenticated;
revoke all on function public.nexo_bot_contexto_v3(text,text) from public,anon,authenticated;
grant execute on function public.nexo_bot_contexto_core_v4(text,text) to service_role;
grant execute on function public.nexo_bot_contexto_v3(text,text) to service_role;
