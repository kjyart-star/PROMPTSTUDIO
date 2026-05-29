-- 1. user_playlists (앨범) 테이블에 exposure_order 컬럼 추가 (우선순위 노출용)
ALTER TABLE public.user_playlists ADD COLUMN IF NOT EXISTS exposure_order integer DEFAULT NULL;

-- 2. song_history (음원) 테이블에 exposure_order 컬럼 추가 (우선순위 노출용)
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS exposure_order integer DEFAULT NULL;
