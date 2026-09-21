-- TEMPORARY LIVE SHADOW CAPTURE.
-- Observes INSERT/UPDATE on resenas and records identity decisions.
-- It must never block or alter the production resenas write.

create or replace function public.capture_review_identity_shadow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_id text;
  v_fingerprint text;
  v_published_at timestamptz;
  v_reviewer_url text;
  v_review_url text;
  v_known public.review_identity_shadow_events%rowtype;
  v_candidate public.review_identity_shadow_events%rowtype;
  v_decision text;
  v_reason text;
  v_matched_event_id bigint;
  v_evidence jsonb := '{}'::jsonb;
begin
  begin
    if new.url like '%/contrib/%' then
      v_reviewer_id := substring(new.url from '/contrib/([0-9]+)');
      v_reviewer_url := new.url;
    elsif tg_op = 'UPDATE' and old.url like '%/contrib/%' then
      v_reviewer_id := substring(old.url from '/contrib/([0-9]+)');
      v_reviewer_url := old.url;
      v_review_url := new.url;
    else
      return new;
    end if;

    if new.place_id is null
      or new.place_id = ''
      or new.review_id is null
      or new.review_id = ''
      or v_reviewer_id is null
      or new.estrellas is null
      or new.estrellas < 1
      or new.estrellas > 5
    then
      return new;
    end if;

    v_fingerprint :=
      new.estrellas::text || '|' ||
      lower(regexp_replace(trim(coalesce(new.comentario, '')), '\s+', ' ', 'g'));

    if new.fecha_resena is not null then
      v_published_at := new.fecha_resena at time zone 'Europe/Madrid';
    end if;

    select *
      into v_known
    from public.review_identity_shadow_events
    where provider = 'google'
      and provider_review_id = new.review_id
    order by last_seen_at desc
    limit 1;

    if found and v_known.content_fingerprint = v_fingerprint then
      update public.review_identity_shadow_events
      set
        last_seen_at = now(),
        restaurante_id = coalesce(review_identity_shadow_events.restaurante_id, new.restaurante_id),
        reviewer_url = coalesce(review_identity_shadow_events.reviewer_url, v_reviewer_url),
        review_url = coalesce(review_identity_shadow_events.review_url, v_review_url)
      where id = v_known.id;

      return new;
    end if;

    if found then
      v_decision := 'edited';
      v_reason := 'known-review-id-content-changed';
      v_matched_event_id := v_known.id;
      v_evidence := jsonb_build_object(
        'trigger_op', tg_op,
        'same_provider_review_id', true,
        'previous_stars', v_known.stars,
        'stars_changed', v_known.stars <> new.estrellas
      );
    else
      select *
        into v_candidate
      from public.review_identity_shadow_events
      where provider = 'google'
        and place_id = new.place_id
        and reviewer_id = v_reviewer_id
        and content_fingerprint = v_fingerprint
      order by last_seen_at desc
      limit 1;

      if found then
        v_decision := 'recreated';
        v_reason := 'new-review-id-same-content';
        v_matched_event_id := v_candidate.id;
        v_evidence := jsonb_build_object(
          'trigger_op', tg_op,
          'same_content', true,
          'previous_provider_review_id', v_candidate.provider_review_id
        );
      else
        if v_published_at is not null then
          select *
            into v_candidate
          from public.review_identity_shadow_events
          where provider = 'google'
            and place_id = new.place_id
            and reviewer_id = v_reviewer_id
            and published_at = v_published_at
          order by last_seen_at desc
          limit 1;
        else
          v_candidate.id := null;
        end if;

        if v_candidate.id is not null then
          v_decision := 'recreated';
          v_reason := 'new-review-id-same-published-at';
          v_matched_event_id := v_candidate.id;
          v_evidence := jsonb_build_object(
            'trigger_op', tg_op,
            'same_published_at', true,
            'previous_provider_review_id', v_candidate.provider_review_id,
            'previous_stars', v_candidate.stars,
            'stars_changed', v_candidate.stars <> new.estrellas
          );
        else
          select *
            into v_candidate
          from public.review_identity_shadow_events
          where provider = 'google'
            and place_id = new.place_id
            and reviewer_id = v_reviewer_id
          order by last_seen_at desc
          limit 1;

          if found then
            v_decision := 'candidate';
            v_reason := 'same-reviewer-place-new-review-id-needs-reconciliation';
            v_matched_event_id := v_candidate.id;
            v_evidence := jsonb_build_object(
              'trigger_op', tg_op,
              'previous_provider_review_id', v_candidate.provider_review_id,
              'previous_stars', v_candidate.stars,
              'stars_changed', v_candidate.stars <> new.estrellas
            );
          else
            v_decision := 'new';
            v_reason := 'no-reviewer-place-history';
            v_matched_event_id := null;
            v_evidence := jsonb_build_object('trigger_op', tg_op);
          end if;
        end if;
      end if;
    end if;

    insert into public.review_identity_shadow_events (
      provider,
      restaurante_id,
      place_id,
      reviewer_id,
      provider_review_id,
      stars,
      comment,
      content_fingerprint,
      published_at,
      first_seen_at,
      last_seen_at,
      reviewer_url,
      review_url,
      decision,
      reason,
      matched_event_id,
      evidence,
      source
    )
    values (
      'google',
      new.restaurante_id,
      new.place_id,
      v_reviewer_id,
      new.review_id,
      new.estrellas,
      new.comentario,
      v_fingerprint,
      v_published_at,
      now(),
      now(),
      v_reviewer_url,
      v_review_url,
      v_decision,
      v_reason,
      v_matched_event_id,
      v_evidence,
      'resenas-trigger-shadow'
    );

  exception
    when others then
      -- Shadow instrumentation is deliberately fail-open:
      -- never block the production review write.
      return new;
  end;

  return new;
end;
$$;

drop trigger if exists resenas_review_identity_shadow on public.resenas;

create trigger resenas_review_identity_shadow
after insert or update of review_id, estrellas, comentario, url, place_id, restaurante_id, fecha_resena
on public.resenas
for each row
execute function public.capture_review_identity_shadow();

comment on function public.capture_review_identity_shadow() is
  'Temporary fail-open shadow capture for validating review identity/version rules. Not a production KPI source.';
