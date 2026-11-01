-- 공개 전 가사 싱크 보장(2026-11-02) — 가사가 있는 곡은 시간표가 생겨야 공개된다.
-- 시간표가 없으면 공개 요청을 「공개 대기」(form.publish_pending)로 바꾼다. 곡 주인은 계속 들을 수 있다.
-- 시간표가 생기면 서버(/api/song-history, /api/lrc-free)가 공개하고, 24시간이 지나면 서버가 싱크 없이 공개한다(일반 가사).
-- 규칙은 src/lib/lyricsSync/publishGate.ts 와 같다. API 를 거치지 않는 직접 쓰기(공개 키 REST)도 이 트리거가 막는다.
create or replace function public.song_history_publish_gate()
returns trigger
language plpgsql
-- security invoker(기본): current_user 가 요청한 역할(authenticated·anon·service_role·postgres)이어야 우회 판단이 맞다
set search_path = public
as $$
declare
  lyr text;
  n int;
  synced boolean;
begin
  -- 서버(service_role)·관리자 SQL 은 그대로(공개 대기 해제·24시간 뒤 공개를 서버가 한다)
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if not coalesce(new.is_published, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.is_published, false) then
    return new; -- 이미 공개된 곡(백필된 기존 곡 포함)은 건드리지 않는다
  end if;

  synced := (
      new.form->>'lrc_by' = 'user'
      and jsonb_typeof(new.form->'lrc') = 'array'
      and jsonb_array_length(new.form->'lrc') >= 2
    ) or (
      coalesce(new.form->>'lrc_auto_v', '') ~ '^[0-9]+$'
      and (new.form->>'lrc_auto_v')::int >= 3
      and jsonb_typeof(new.form->'lrc_auto') = 'array'
      and jsonb_array_length(new.form->'lrc_auto') >= 2
    );
  if synced then
    if new.form ? 'publish_pending' then
      new.form := new.form - 'publish_pending';
    end if;
    return new;
  end if;

  lyr := coalesce(nullif(trim(new.lyrics), ''), nullif(trim(new.form->>'lyrics'), ''), nullif(trim(new.form->>'prompt'), ''), '');
  if lyr ~ '\[[0-9]{1,3}:[0-9]{2}' then
    return new; -- 시간 표시가 든 가사(LRC)는 그 자체가 시간표
  end if;
  select count(*) into n
    from regexp_split_to_table(lyr, E'\n') as l
    where trim(l) <> '' and trim(l) !~ '^[\[\(].*[\]\)]$';
  if n < 2 then
    return new; -- 경음악·가사 없음
  end if;

  new.is_published := false;
  new.form := coalesce(new.form, '{}'::jsonb)
    || jsonb_build_object('publish_pending', coalesce(
         case when tg_op = 'UPDATE' then old.form->'publish_pending' end,
         jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))));
  return new;
end;
$$;

drop trigger if exists song_history_publish_gate on public.song_history;
create trigger song_history_publish_gate
  before insert or update of is_published, form on public.song_history
  for each row execute function public.song_history_publish_gate();
