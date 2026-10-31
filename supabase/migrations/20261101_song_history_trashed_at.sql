-- 쿠키뮤직 스튜디오 휴지통 — 소프트 삭제 컬럼 추가(추가만, DELETE 없음)
alter table public.song_history add column if not exists trashed_at timestamptz;
create index if not exists song_history_trashed_idx on public.song_history (user_id, trashed_at);
