-- 앱이 handle 주소로 옮겨간 뒤에 적용: 공개 뷰에서 이메일(앞부분 포함)을 뺀다. 데이터 변경 없음(뷰 재정의).
-- 목록·검색·재생 화면이 정지 계정 콘텐츠를 숨길 수 있게 is_banned 는 포함한다.
drop view if exists public.public_profiles;
create view public.public_profiles with (security_invoker = false) as
  select id, display_name, avatar_url, banner_url, bio, tags,
         followers, following, plays, likes, handle, is_admin, is_banned, created_at
  from public.profiles;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
