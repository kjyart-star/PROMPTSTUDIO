-- 쿠키뮤직 (1) 아티스트 주소를 이메일 앞부분 대신 handle 로, (2) 정지 컬럼 is_banned. 추가·UPDATE 만, 삭제 없음.
-- handle 은 이메일과 무관한 무작위 문자열로 자동 생성한다(이메일 앞부분을 다시 공개하지 않기 위해). 사용자가 프로필에서 바꿀 수 있다.
create or replace function public.gen_profile_handle(p_id uuid) returns text
  language plpgsql volatile set search_path = public as $$
declare
  cand text;
  n int := 0;
begin
  loop
    cand := 'user-' || substr(md5(p_id::text || ':' || clock_timestamp()::text || ':' || n::text || random()::text), 1, 8 + (n / 5));
    exit when not exists (select 1 from public.profiles where lower(handle) = cand);
    n := n + 1;
  end loop;
  return cand;
end $$;

create or replace function public.profiles_default_handle() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.handle is null or btrim(new.handle) = '' then
    new.handle := public.gen_profile_handle(new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_default_handle on public.profiles;
create trigger trg_profiles_default_handle before insert on public.profiles
  for each row execute function public.profiles_default_handle();

-- 기존 행 백필(handle 이 비어 있는 행만)
update public.profiles set handle = public.gen_profile_handle(id) where handle is null or btrim(handle) = '';

-- 정지 컬럼(운영 DB 에 없었다). 기본 false.
alter table public.profiles add column if not exists is_banned boolean not null default false;
