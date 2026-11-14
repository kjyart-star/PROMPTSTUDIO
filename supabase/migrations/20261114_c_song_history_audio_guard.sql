-- H-6: 사용자 세션은 song_history.audio_url 에 남의 저장소 경로를 넣을 수 없다(공개 키 REST 직접 쓰기 포함). 행 삭제 없음.
-- 허용: 비어 있음 / 외부 https / audio|stems/<본인 id>/… / audio/<곡 id>.<확장자> 중 곡 id 가 이 행이거나, 본인 곡이거나, 공개된 곡.
-- 서비스 키·관리자(is_admin)는 그대로. 값이 바뀌지 않는 UPDATE 는 검사하지 않는다(기존 행 영향 없음).
create or replace function public.song_history_audio_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v text := new.audio_url;
  sid uuid;
  ok boolean := false;
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if tg_op = 'UPDATE' and v is not distinct from old.audio_url then return new; end if;
  if v is null or v = '' then return new; end if;
  if public.is_admin_user() then return new; end if;
  if v ~ '\.\.' or length(v) > 500 then raise exception 'invalid audio_url' using errcode = '42501'; end if;
  if v ~* '^https://' then return new; end if;
  if new.user_id is not null and (v like 'audio/' || new.user_id::text || '/%' or v like 'stems/' || new.user_id::text || '/%') then return new; end if;
  if v ~* '^audio/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$' then
    sid := substring(v from 7 for 36)::uuid;
    if sid = new.id then ok := true;
    else
      select true into ok from public.song_history s where s.id = sid and (s.user_id = new.user_id or s.is_published) limit 1;
    end if;
    if coalesce(ok, false) then return new; end if;
  end if;
  raise exception 'invalid audio_url' using errcode = '42501';
end $$;
drop trigger if exists trg_song_history_audio_guard on public.song_history;
create trigger trg_song_history_audio_guard before insert or update on public.song_history
  for each row execute function public.song_history_audio_guard();
