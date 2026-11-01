-- 공개 곡 가사 자동 맞춤 결과 공유 — 한 번 계산되면 모두가 쓴다(새 테이블만, 원곡 song_history 는 건드리지 않음)
create table if not exists public.song_lrc_auto (
  song_id uuid not null references public.song_history(id) on delete cascade,
  v integer not null,
  lrc jsonb not null,
  model text not null default 'whisper-small-dtw',
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (song_id, v)
);

alter table public.song_lrc_auto enable row level security;

-- 읽기: 공개 곡이면 누구나
drop policy if exists "song_lrc_auto_read_published" on public.song_lrc_auto;
create policy "song_lrc_auto_read_published" on public.song_lrc_auto
  for select to anon, authenticated
  using (exists (select 1 from public.song_history s where s.id = song_id and s.is_published));

-- 쓰기: 로그인 사용자, 자기 이름으로, 공개 곡에만. 수정·삭제 정책 없음(첫 유효값 하나만 유지; 지우는 건 service_role 만)
drop policy if exists "song_lrc_auto_insert_own" on public.song_lrc_auto;
create policy "song_lrc_auto_insert_own" on public.song_lrc_auto
  for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and exists (select 1 from public.song_history s where s.id = song_id and s.is_published)
  );

grant select on public.song_lrc_auto to anon, authenticated;
grant insert on public.song_lrc_auto to authenticated;
