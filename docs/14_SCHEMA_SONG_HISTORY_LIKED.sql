-- =====================================================
-- AI Music Platform — Schema Fix (song_history liked column)
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

DO $$ 
BEGIN
    -- song_history 테이블에 liked 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='liked') THEN
        ALTER TABLE song_history ADD COLUMN liked boolean DEFAULT false;
    END IF;
END $$;

-- Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
