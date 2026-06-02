-- 1. song_history 테이블에 video_url 추가
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS video_url text;

-- 2. Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
