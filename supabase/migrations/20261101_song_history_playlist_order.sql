-- 재생목록 안 곡 순서(사용자 지정). exposure_order 는 사이트 노출용이라 따로 둔다. 추가만.
alter table public.song_history add column if not exists playlist_order integer;
