-- 남의 공개 곡 가사 자동 맞춤 제출 — 두 사람 결과가 1초 안에서 일치할 때만 song_lrc_auto(공개 결과)로 올린다(2026-11-02).
-- 서버(service_role)만 읽고 쓴다. 제출자 본인도 표를 직접 읽거나 쓰지 못한다.
create table if not exists public.song_lrc_submissions (
  song_id uuid not null references public.song_history(id) on delete cascade,
  v integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  lrc jsonb not null,
  created_at timestamptz not null default now(),
  primary key (song_id, v, user_id)
);
alter table public.song_lrc_submissions enable row level security;
revoke all on public.song_lrc_submissions from anon, authenticated;

-- 공개 결과는 서버(/api/song-lrc-auto)가 검증·합의 뒤에만 쓴다 — 로그인 사용자의 직접 쓰기를 막는다(읽기는 그대로)
drop policy if exists "song_lrc_auto_insert_own" on public.song_lrc_auto;
revoke insert on public.song_lrc_auto from authenticated;
