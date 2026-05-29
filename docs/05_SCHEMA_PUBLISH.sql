-- =====================================================
-- AI Music Platform — Schema Update (Publishing Feature)
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- song_history 테이블에 is_published 컬럼이 없다면 추가합니다.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='song_history' AND column_name='is_published'
    ) THEN
        ALTER TABLE song_history ADD COLUMN is_published boolean DEFAULT false;
    END IF;
END $$;
