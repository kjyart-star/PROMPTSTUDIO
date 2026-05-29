-- =====================================================
-- AI Music Platform — Playlist (Album) Schema
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. user_playlists 테이블 생성
CREATE TABLE IF NOT EXISTS user_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_url text,
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS 정책 설정 (자신의 플레이리스트만 조회/수정/삭제 가능, 단 public 플레이리스트는 누구나 조회 가능)
ALTER TABLE user_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published playlists" ON user_playlists;
CREATE POLICY "Public can view published playlists" ON user_playlists
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Users can manage own playlists" ON user_playlists;
CREATE POLICY "Users can manage own playlists" ON user_playlists
  FOR ALL USING (auth.uid() = user_id);

-- 2. song_history 테이블에 playlist_id 추가
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='playlist_id') THEN
        ALTER TABLE song_history ADD COLUMN playlist_id uuid REFERENCES user_playlists(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. song_history의 is_published 기본값을 false로 명확히 함
ALTER TABLE song_history ALTER COLUMN is_published SET DEFAULT false;

-- Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
