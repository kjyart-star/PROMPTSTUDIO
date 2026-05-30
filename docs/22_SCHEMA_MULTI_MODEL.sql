-- =====================================================
-- 다중 AI 음악 모델 (Suno, Udio, Google 등)을 지원하기 위한 스키마 확장
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 전체 붙여넣기 → Run
-- =====================================================

-- 1. song_history 테이블 확장 (사용자 생성 이력)
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS model_provider text DEFAULT 'suno';
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'v3.5';

-- 2. tracks 테이블 확장 (최종 공개 곡 메타데이터)
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS model_provider text DEFAULT 'suno';
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'v3.5';

-- 3. Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
