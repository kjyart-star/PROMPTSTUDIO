-- =====================================================
-- AI Music Platform — song_history 테이블 전체 컬럼 누락 방지 통합 패치
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. song_history 테이블에 누락될 수 있는 모든 컬럼 안전하게 추가
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS suno_task_id text;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS exposure_order integer DEFAULT NULL;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS genre text DEFAULT '';
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS liked boolean DEFAULT false;

-- 2. Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
