-- =====================================================
-- AI Music Platform — Consolidated Database & Schema Fix
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. profiles 테이블 컬럼 확인 및 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_guide_ids text[] DEFAULT '{}'::text[];

-- 2. user_playlists (앨범) 테이블 생성 및 컬럼 보완
CREATE TABLE IF NOT EXISTS public.user_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_url text DEFAULT '/default-album.png',
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- description 컬럼 추가
ALTER TABLE public.user_playlists ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- user_playlists RLS 정책 설정
ALTER TABLE public.user_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published playlists" ON public.user_playlists;
CREATE POLICY "Public can view published playlists" ON public.user_playlists
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Users can manage own playlists" ON public.user_playlists;
CREATE POLICY "Users can manage own playlists" ON public.user_playlists
  FOR ALL USING (auth.uid() = user_id);

-- 3. user_guides 테이블 생성 및 RLS 설정
CREATE TABLE IF NOT EXISTS public.user_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own guides" ON public.user_guides;
CREATE POLICY "Users can read own guides" ON public.user_guides
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own guides" ON public.user_guides;
CREATE POLICY "Users can insert own guides" ON public.user_guides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own guides" ON public.user_guides;
CREATE POLICY "Users can update own guides" ON public.user_guides
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own guides" ON public.user_guides;
CREATE POLICY "Users can delete own guides" ON public.user_guides
  FOR DELETE USING (auth.uid() = user_id);

-- 4. song_history 테이블 컬럼 및 업데이트 RLS 설정
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='playlist_id') THEN
        ALTER TABLE public.song_history ADD COLUMN playlist_id uuid REFERENCES public.user_playlists(id) ON DELETE SET NULL;
    END IF;
END $$;

-- song_history의 is_published 기본값을 false로 설정
ALTER TABLE public.song_history ALTER COLUMN is_published SET DEFAULT false;

-- song_history 업데이트 RLS 정책 추가 (음원 퍼블리싱/플레이리스트 할당용)
DROP POLICY IF EXISTS "Users can update own song history" ON public.song_history;
CREATE POLICY "Users can update own song history" ON public.song_history
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Storage 버킷 및 권한 설정 (아바타용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read avatars bucket" ON storage.objects;
CREATE POLICY "public read avatars bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users can upload avatars" ON storage.objects;
CREATE POLICY "users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' and auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users can update own avatars" ON storage.objects;
CREATE POLICY "users can update own avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' and owner = auth.uid());

DROP POLICY IF EXISTS "users can delete own avatars" ON storage.objects;
CREATE POLICY "users can delete own avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' and owner = auth.uid());

-- 6. Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
