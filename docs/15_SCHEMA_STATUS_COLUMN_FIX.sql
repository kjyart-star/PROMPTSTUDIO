-- =====================================================
-- AI Music Platform — song_history status 컬럼 추가 및 스키마 캐시 갱신
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. song_history 테이블에 status 컬럼이 없을 경우 추가
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

-- 2. Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
