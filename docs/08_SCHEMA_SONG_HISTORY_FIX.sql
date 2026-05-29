-- =====================================================
-- AI Music Platform — Schema Fix (song_history)
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

DO $$ 
BEGIN
    -- audio_url 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='audio_url') THEN
        ALTER TABLE song_history ADD COLUMN audio_url text;
    END IF;

    -- image_url 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='image_url') THEN
        ALTER TABLE song_history ADD COLUMN image_url text;
    END IF;
    
    -- is_published (혹시 누락되었을 경우를 대비)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='is_published') THEN
        ALTER TABLE song_history ADD COLUMN is_published boolean DEFAULT false;
    END IF;
END $$;

-- Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
