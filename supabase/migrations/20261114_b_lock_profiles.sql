-- H-4 (2/2): profiles 직접 읽기 차단 + 권한 컬럼 보호. 앱이 public_profiles 로 옮겨간 뒤에 적용한다. 행 삭제 없음.
drop policy if exists "Enable read access for all users" on public.profiles;
drop policy if exists "본인 프로필 읽기" on public.profiles;
drop policy if exists "관리자 프로필 읽기" on public.profiles;
create policy "본인 프로필 읽기" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "관리자 프로필 읽기" on public.profiles for select to authenticated using (public.is_admin_user());

revoke all on public.profiles from anon;
-- 본인이 바꿀 수 있는 컬럼만 허용: is_admin·credits·created_at 은 서비스 키 전용
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, display_name, avatar_url, active_guide_ids, updated_at, banner_url, bio, tags, followers, following, plays, likes, handle) on public.profiles to authenticated;
grant update (id, email, display_name, avatar_url, active_guide_ids, updated_at, banner_url, bio, tags, followers, following, plays, likes, handle) on public.profiles to authenticated;

-- 트리거: 앞으로 권한이 다시 열려도 사용자 세션은 is_admin·credits·is_banned 를 못 바꾼다
create or replace function public.enforce_profile_privileges() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_admin is distinct from old.is_admin
       or new.credits is distinct from old.credits
       or (to_jsonb(new)->>'is_banned') is distinct from (to_jsonb(old)->>'is_banned') then
      raise exception 'protected profile column' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_enforce_profile_privileges on public.profiles;
create trigger trg_enforce_profile_privileges before update on public.profiles
  for each row execute function public.enforce_profile_privileges();

-- handle 고유성(대소문자 무시)
create unique index if not exists profiles_handle_unique on public.profiles (lower(handle)) where handle is not null;
