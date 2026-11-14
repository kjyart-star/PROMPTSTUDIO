-- H-4 (1/2): 공개용 뷰 + 관리자 판정 함수. 추가만 한다(기존 동작 유지, 삭제 없음).
-- 뷰의 email 은 아티스트 주소(slug)용 앞부분만 담은 마스킹 값 「앞부분@」 이다. 도메인·전체 주소는 나가지 않는다.
create or replace function public.is_admin_user() returns boolean
  language sql security definer stable set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
revoke all on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated;

create or replace view public.public_profiles with (security_invoker = false) as
  select id,
         split_part(email, '@', 1) || '@' as email,
         display_name, avatar_url, banner_url, bio, tags,
         followers, following, plays, likes, handle, is_admin, created_at
  from public.profiles;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
