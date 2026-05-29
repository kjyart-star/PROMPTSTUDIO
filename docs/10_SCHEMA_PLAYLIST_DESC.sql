-- =====================================================
-- AI Music Platform — Playlist Description Schema
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_playlists' AND column_name='description') THEN
        ALTER TABLE user_playlists ADD COLUMN description text DEFAULT '';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
