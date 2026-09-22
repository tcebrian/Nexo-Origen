-- WhatsApp bot canonicalization.
-- Keep Make-facing function names stable while routing every deterministic
-- reputation KPI through the same canonical Supabase fact/metric layer.

create or replace function public.nexo_bot_consulta_core_v4(
  p_phone text,
  p_request text
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $function$
declare
  a public.nexo_bot_accesos%rowtype;
  q jsonb;
  intent text;
  period text;
  ids bigint[];
  requested bigint[];
  scope_name text;
  target numeric := 4.4;
  local_now timestamp := now() at time zone 'Europe/Madrid';
  d1 date;
  d2 date;
  c1 date;
  c2 date;
  days_count integer;
  n bigint := 0;
  neg bigint := 0;
  pos bigint := 0;
  neutral bigint := 0;
  attention bigint := 0;
  total numeric := 0;
  mean numeric;
  pn bigint := 0;
  pm numeric;
  msg text;
  row record;
  items jsonb := '[]'::jsonb;
  cats jsonb := '[]'::jsonb;
  ranking jsonb := '[]'::jsonb;
begin
  select *
    into a
  from public.nexo_bot_accesos
  where telefono = regexp_replace(p_phone,'[^0-9]','','g')
    and activo;

  if not found then
    return jsonb_build_object('ok',false,'message','Este número no tiene acceso a Nexo.');
  end if;

  if length(coalesce(p_request,'')) > 6000 then
    return jsonb_build_object('ok',false,'message','La consulta es demasiado larga. Indica un restaurante y un periodo.');
  end if;

  begin
    q := p_request::jsonb;
  exception when others then
    return jsonb_build_object('ok',false,'message','No he entendido la consulta. Prueba: media de BK Zizur esta semana.');
  end;

  intent := coalesce(q->>'intent','help');
  period := coalesce(q->>'period','current_week');

  if intent='write' then
    return jsonb_build_object('ok',true,'message','Nexo es solo de consulta. No puedo crear, cambiar ni borrar datos desde WhatsApp.');
  end if;

  if intent='clarify' then
    return jsonb_build_object('ok',true,'message','Indica el nombre completo del restaurante y el periodo. Por ejemplo: BK Huesca o BK Huesca II; esta semana o la semana pasada.');
  end if;

  if intent not in ('summary','comparison','negative','motives','ranking') then
    return jsonb_build_object(
      'ok',true,
      'message',E'Puedes consultar:\n• Media de BK Zizur esta semana.\n• Compara Burger King con la semana pasada.\n• Negativas de Vault este mes.\n• Motivos de las negativas de BK Huesca.\n• Ranking de todos los restaurantes.\n\nSolo consulta; cada mensaje debe indicar el restaurante o marca.'
    );
  end if;

  begin
    select coalesce(array_agg(value::bigint),'{}'::bigint[])
      into requested
    from jsonb_array_elements_text(coalesce(q->'restaurant_ids','[]'::jsonb));
  exception when others then
    return jsonb_build_object('ok',false,'message','No he reconocido el restaurante. Indica su nombre completo.');
  end;

  if cardinality(requested)>0
     and exists(
       select 1
       from unnest(requested) x
       where not exists(
         select 1
         from public.restaurantes r
         where r.id=x
           and coalesce(r.activo,true)
           and (a.todos_restaurantes or r.id=any(a.restaurante_ids))
       )
     ) then
    return jsonb_build_object('ok',false,'message','Uno de los restaurantes no existe o no está incluido en tus permisos.');
  end if;

  select array_agg(r.id order by r.id),
         case when count(*)=1 then min(r.nombre) else count(*)||' restaurantes' end
    into ids,scope_name
  from public.restaurantes r
  where coalesce(r.activo,true)
    and (a.todos_restaurantes or r.id=any(a.restaurante_ids))
    and (cardinality(requested)=0 or r.id=any(requested));

  if ids is null then
    return jsonb_build_object('ok',false,'message','No tienes restaurantes asignados.');
  end if;

  if ids=array[33]::bigint[] then target:=4.7; end if;

  case period
    when 'all_time' then
      select min(c.activity_date)
        into d1
      from public.nexo_canonical_reviews(null,local_now::date,ids) c;
      d1 := coalesce(d1,local_now::date);
      d2 := local_now::date;
      c1 := null; c2 := null;
    when 'current_week' then
      d1 := date_trunc('week',local_now)::date;
      d2 := local_now::date;
      c1 := d1-7; c2 := d1-1;
    when 'previous_week' then
      d2 := date_trunc('week',local_now)::date-1;
      d1 := d2-6;
      c2 := d1-1; c1 := c2-6;
    when 'current_month' then
      d1 := date_trunc('month',local_now)::date;
      d2 := local_now::date;
      c2 := d1-1; c1 := date_trunc('month',c2)::date;
    when 'previous_month' then
      c2 := (date_trunc('month',local_now)::date)-1;
      d2 := c2;
      d1 := date_trunc('month',d2)::date;
      c2 := d1-1; c1 := date_trunc('month',c2)::date;
    when 'today' then
      d1 := local_now::date; d2 := d1;
      c1 := d1-1; c2 := c1;
    when 'yesterday' then
      d1 := local_now::date-1; d2 := d1;
      c1 := d1-1; c2 := c1;
    when 'custom' then
      begin
        d1 := (q->>'start_date')::date;
        d2 := (q->>'end_date')::date;
      exception when others then
        return jsonb_build_object('ok',false,'message','Indica las fechas como día/mes/año.');
      end;
      if d1 is null or d2 is null or d2<d1 or (d2-d1)>366 or d2>local_now::date then
        return jsonb_build_object('ok',false,'message','Usa un periodo válido de hasta 366 días, sin fechas futuras.');
      end if;
      days_count := d2-d1+1;
      c2 := d1-1;
      c1 := c2-days_count+1;
    else
      return jsonb_build_object('ok',false,'message','Indica esta semana, semana pasada, este mes, mes pasado, hoy, ayer o unas fechas concretas.');
  end case;

  select
    m.network_total_resenas,
    m.network_rating_sum,
    m.network_media_exacta,
    m.network_negativas,
    m.network_positivas,
    m.network_neutras,
    m.network_atencion
  into n,total,mean,neg,pos,neutral,attention
  from public.nexo_reputation_period_metrics(d1,d2,ids) m
  limit 1;

  n:=coalesce(n,0);
  total:=coalesce(total,0);
  neg:=coalesce(neg,0);
  pos:=coalesce(pos,0);
  neutral:=coalesce(neutral,0);
  attention:=coalesce(attention,0);

  if c1 is not null and c2 is not null then
    select m.network_total_resenas,m.network_media_exacta
      into pn,pm
    from public.nexo_reputation_period_metrics(c1,c2,ids) m
    limit 1;
    pn:=coalesce(pn,0);
  end if;

  msg:=scope_name||E'\n'||to_char(d1,'DD/MM/YYYY')||' – '||to_char(d2,'DD/MM/YYYY');
  if period in ('current_week','current_month','today','all_time') then
    msg:=msg||' (en curso)';
  end if;
  msg:=msg||E'\nMedia ponderada: '||
    case when n>0 then replace(round(mean,2)::text,'.',',') else 'sin reseñas' end||
    ' | Reseñas: '||n||
    E'\nPositivas (4–5): '||pos||' · Neutras (3): '||neutral||' · Negativas (1–2): '||neg;

  if n between 1 and 6 then
    msg:=msg||E'\nVolumen bajo: la media puede variar mucho con pocas reseñas.';
  end if;

  if n>0 then
    msg:=msg||E'\nEstado (objetivo '||replace(target::text,'.',',')||'): '||
      case when mean>=target then 'verde' when mean>=4 then 'amarillo' else 'rojo' end;
  end if;

  if intent in ('summary','comparison') and c1 is not null then
    msg:=msg||E'\n\nPeriodo anterior: '||to_char(c1,'DD/MM/YYYY')||' – '||to_char(c2,'DD/MM/YYYY')||
      E'\nMedia: '||case when pn>0 then replace(round(pm,2)::text,'.',',') else 'sin reseñas' end||
      ' | Reseñas: '||pn;
    if n>0 and pn>0 and mean is not null and pm is not null then
      msg:=msg||E'\nVariación: '||
        case when mean-pm>0 then '+' else '' end||
        replace(round(mean-pm,2)::text,'.',',')||' puntos.';
    end if;
    if period in ('current_week','current_month','today') then
      msg:=msg||E'\nComparación parcial frente al periodo anterior completo.';
    end if;
  end if;

  if intent='negative' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
      into items
    from (
      select c.autor,
             s.nombre as restaurante,
             c.estrellas,
             left(coalesce(nullif(c.comentario,''),'Sin texto'),240) as comentario,
             to_char(c.original_ts,'DD/MM HH24:MI') as fecha
      from public.nexo_canonical_reviews(d1,d2,ids) c
      join public.restaurantes s on s.id=c.restaurante_id
      where c.estrellas<=2
      order by c.original_ts desc,c.id desc
      limit 6
    ) x;

    msg:=msg||E'\n\n'||
      case when neg=0 then 'Sin reseñas negativas.'
           else 'Últimas '||least(neg,6)||' de '||neg||' negativas:' end;

    for row in select value as v from jsonb_array_elements(items) loop
      msg:=msg||E'\n\n'||(row.v->>'restaurante')||' · '||
        (row.v->>'estrellas')||' estrellas · '||(row.v->>'fecha')||
        E'\n'||coalesce(row.v->>'autor','Sin autor')||': '||(row.v->>'comentario');
    end loop;
  end if;

  if intent='motives' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'categoria',x.categoria,
          'menciones',x.motivo_count,
          'porcentaje',round(x.percent,1)
        )
        order by x.motivo_count desc,x.categoria
      ),
      '[]'::jsonb
    )
    into cats
    from (
      select * from public.nexo_reputation_motives_period(d1,d2,ids)
      limit 10
    ) x;

    msg:=msg||E'\n\nMotivos registrados en reseñas que requieren atención (1–3★):';
    if jsonb_array_length(cats)=0 then
      msg:=msg||case when attention=0 then ' sin reseñas que requieran atención.' else ' sin clasificaciones disponibles.' end;
    end if;
    for row in select value as v from jsonb_array_elements(cats) loop
      msg:=msg||E'\n• '||(row.v->>'categoria')||': '||(row.v->>'menciones')||
        ' ('||(row.v->>'porcentaje')||'%)';
    end loop;
  end if;

  if intent='ranking' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.media desc nulls last,x.resenas desc,x.nombre),'[]'::jsonb)
      into ranking
    from (
      select r.id,r.nombre,
             m.total_resenas as resenas,
             case when m.total_resenas>0 then round(m.media_exacta,2) else null end as media,
             m.negativas
      from public.nexo_reputation_period_metrics(d1,d2,ids) m
      join public.restaurantes r on r.id=m.restaurante_id
    ) x;

    msg:=msg||E'\n\nRanking por media (mayor a menor):';
    for row in select value as v from jsonb_array_elements(ranking) loop
      msg:=msg||E'\n• '||(row.v->>'nombre')||': '||
        coalesce(replace(row.v->>'media','.',','),'sin reseñas')||
        ' · '||(row.v->>'resenas')||' reseñas · '||(row.v->>'negativas')||' negativas';
    end loop;
  end if;

  msg:=msg||E'\n\nDatos canónicos de Nexo · Supabase · Europe/Madrid.';

  return jsonb_build_object(
    'ok',true,
    'message',left(msg,4000),
    'intent',intent,
    'count',n,
    'sum',total,
    'average',mean,
    'positive_count',pos,
    'neutral_count',neutral,
    'negative_count',neg,
    'attention_count',attention,
    'previous_count',pn,
    'previous_average',pm,
    'period_start',d1,
    'period_end',d2,
    'ranking',ranking,
    'motives',cats,
    'restaurant_ids',to_jsonb(ids),
    'source','nexo_reputation_period_metrics'
  );
end;
$function$;

create or replace function public.nexo_bot_consulta_v1(p_phone text,p_request text)
returns jsonb
language sql
stable
set search_path=''
as $function$
  select public.nexo_bot_consulta_core_v4(p_phone,p_request);
$function$;

create or replace function public.nexo_bot_consulta_v3(p_phone text,p_request text)
returns jsonb
language sql
stable
set search_path=''
as $function$
  select public.nexo_bot_consulta_core_v4(p_phone,p_request);
$function$;

revoke all on function public.nexo_bot_consulta_core_v4(text,text) from public,anon,authenticated;
revoke all on function public.nexo_bot_consulta_v1(text,text) from public,anon,authenticated;
revoke all on function public.nexo_bot_consulta_v3(text,text) from public,anon,authenticated;
grant execute on function public.nexo_bot_consulta_core_v4(text,text) to service_role;
grant execute on function public.nexo_bot_consulta_v1(text,text) to service_role;
grant execute on function public.nexo_bot_consulta_v3(text,text) to service_role;
