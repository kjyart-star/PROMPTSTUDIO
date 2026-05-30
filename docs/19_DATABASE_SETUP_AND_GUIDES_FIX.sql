-- =====================================================
-- AI Music Platform — Database Setup & Guides File Support
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 전체 복사 후 붙여넣기 → Run
-- =====================================================

-- 0. pgcrypto 확장 활성화 (UUID 생성용)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. is_admin() 함수 재정의 (profiles 테이블의 is_admin 컬럼 기반 RLS 검증)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- 2. 아티스트 테이블 생성
CREATE TABLE IF NOT EXISTS public.artists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  bio             text,
  avatar_url      text,
  banner_url      text,
  links           jsonb DEFAULT '{}'::jsonb,
  is_ai_generated boolean DEFAULT true,
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artists_slug ON public.artists(slug);

-- 3. 앨범 테이블 생성
CREATE TABLE IF NOT EXISTS public.albums (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  artist_id       uuid REFERENCES public.artists(id) ON DELETE CASCADE,
  title           text NOT NULL,
  release_type    text NOT NULL DEFAULT 'single'
                  CHECK (release_type IN ('single', 'ep', 'lp', 'compilation')),
  cover_url       text,
  release_date    date,
  genres          text[] DEFAULT '{}',
  moods           text[] DEFAULT '{}',
  description     text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  generation_tool text,
  total_plays     bigint DEFAULT 0,
  total_likes     bigint DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_albums_slug ON public.albums(slug);
CREATE INDEX IF NOT EXISTS idx_albums_status ON public.albums(status);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON public.albums(artist_id);

-- 4. 트랙 테이블 생성
CREATE TABLE IF NOT EXISTS public.tracks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id        uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  track_number    int NOT NULL DEFAULT 1,
  title           text NOT NULL,
  duration_sec    int,
  file_url        text NOT NULL,
  file_size       bigint,
  waveform_data   jsonb,
  lyrics          text,
  style_prompt    text,
  bpm             int,
  song_key        text,
  prompt_meta     jsonb DEFAULT '{}'::jsonb,
  play_count      bigint DEFAULT 0,
  like_count      bigint DEFAULT 0,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(album_id, track_number)
);

CREATE INDEX IF NOT EXISTS idx_tracks_album ON public.tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);

-- 5. 재생 이벤트 테이블 생성
CREATE TABLE IF NOT EXISTS public.play_events (
  id              bigserial PRIMARY KEY,
  track_id        uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  played_at       timestamptz DEFAULT now(),
  duration_played int,
  ip_hash         text,
  country_code    text
);

CREATE INDEX IF NOT EXISTS idx_play_events_track_time ON public.play_events(track_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_events_time ON public.play_events(played_at DESC);

-- 6. 좋아요 테이블 생성
CREATE TABLE IF NOT EXISTS public.likes (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id   uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_track ON public.likes(track_id);

-- 7. 차트 스냅샷 테이블 생성
CREATE TABLE IF NOT EXISTS public.chart_snapshots (
  id          bigserial PRIMARY KEY,
  period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_date date NOT NULL,
  track_id    uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  rank        int NOT NULL,
  play_count  bigint,
  rank_change int,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_lookup ON public.chart_snapshots(period_type, period_date, rank);

-- 8. 자동 updated_at 트리거 함수 및 바인딩
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  return new;
END;
$$;

DROP TRIGGER IF EXISTS trg_artists_updated ON public.artists;
CREATE TRIGGER trg_artists_updated BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_albums_updated ON public.albums;
CREATE TRIGGER trg_albums_updated BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tracks_updated ON public.tracks;
CREATE TRIGGER trg_tracks_updated BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. 재생수 자동 집계 트리거 함수 및 바인딩
CREATE OR REPLACE FUNCTION public.increment_play_counts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.duration_played >= 30 THEN
    UPDATE public.tracks SET play_count = play_count + 1 WHERE id = new.track_id;
    UPDATE public.albums SET total_plays = total_plays + 1
      WHERE id = (SELECT album_id FROM public.tracks WHERE id = new.track_id);
  END IF;
  return new;
END;
$$;

DROP TRIGGER IF EXISTS trg_play_increment ON public.play_events;
CREATE TRIGGER trg_play_increment AFTER INSERT ON public.play_events
  FOR EACH ROW EXECUTE FUNCTION public.increment_play_counts();

-- 10. 좋아요 카운트 증감 트리거 함수 및 바인딩
CREATE OR REPLACE FUNCTION public.update_like_counts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.tracks SET like_count = like_count + 1 WHERE id = new.track_id;
    UPDATE public.albums SET total_likes = total_likes + 1
      WHERE id = (SELECT album_id FROM public.tracks WHERE id = new.track_id);
    return new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.tracks SET like_count = greatest(0, like_count - 1) WHERE id = old.track_id;
    UPDATE public.albums SET total_likes = greatest(0, total_likes - 1)
      WHERE id = (SELECT album_id FROM public.tracks WHERE id = old.track_id);
    return old;
  END IF;
  return null;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_count_update ON public.likes;
CREATE TRIGGER trg_like_count_update AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_like_counts();

-- 11. Row Level Security (RLS) 활성화 및 정책 적용
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_snapshots ENABLE ROW LEVEL SECURITY;

-- artists RLS 정책
DROP POLICY IF EXISTS "public read artists" ON public.artists;
CREATE POLICY "public read artists" ON public.artists
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write artists" ON public.artists;
CREATE POLICY "admin write artists" ON public.artists
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- albums RLS 정책
DROP POLICY IF EXISTS "public read published albums" ON public.albums;
CREATE POLICY "public read published albums" ON public.albums
  FOR SELECT USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "admin write albums" ON public.albums;
CREATE POLICY "admin write albums" ON public.albums
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tracks RLS 정책
DROP POLICY IF EXISTS "public read published tracks" ON public.tracks;
CREATE POLICY "public read published tracks" ON public.tracks
  FOR SELECT USING (
    public.is_admin() OR (
      status = 'published' AND EXISTS (
        SELECT 1 FROM public.albums
        WHERE public.albums.id = public.tracks.album_id AND public.albums.status = 'published'
      )
    )
  );

DROP POLICY IF EXISTS "admin write tracks" ON public.tracks;
CREATE POLICY "admin write tracks" ON public.tracks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- play_events RLS 정책
DROP POLICY IF EXISTS "anyone insert play events" ON public.play_events;
CREATE POLICY "anyone insert play events" ON public.play_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admin read play events" ON public.play_events;
CREATE POLICY "admin read play events" ON public.play_events
  FOR SELECT USING (public.is_admin());

-- likes RLS 정책
DROP POLICY IF EXISTS "users manage own likes" ON public.likes;
CREATE POLICY "users manage own likes" ON public.likes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- chart_snapshots RLS 정책
DROP POLICY IF EXISTS "public read charts" ON public.chart_snapshots;
CREATE POLICY "public read charts" ON public.chart_snapshots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write charts" ON public.chart_snapshots;
CREATE POLICY "admin write charts" ON public.chart_snapshots
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 12. 공용 지침서 (system_guides) 파일 컬럼 추가
ALTER TABLE public.system_guides ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.system_guides ADD COLUMN IF NOT EXISTS file_name text;

-- 13. Storage 버킷 설정 및 정책 생성
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('artists', 'artists', true),
  ('albums', 'albums', true),
  ('tracks', 'tracks', false),
  ('system-guides', 'system-guides', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: artists 버킷
DROP POLICY IF EXISTS "admin upload artists" ON storage.objects;
CREATE POLICY "admin upload artists" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'artists' AND public.is_admin());

DROP POLICY IF EXISTS "public read artists bucket" ON storage.objects;
CREATE POLICY "public read artists bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'artists');

-- Storage RLS: albums 버킷
DROP POLICY IF EXISTS "admin upload albums" ON storage.objects;
CREATE POLICY "admin upload albums" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'albums' AND public.is_admin());

DROP POLICY IF EXISTS "public read albums bucket" ON storage.objects;
CREATE POLICY "public read albums bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'albums');

-- Storage RLS: tracks 버킷
DROP POLICY IF EXISTS "admin upload tracks" ON storage.objects;
CREATE POLICY "admin upload tracks" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tracks' AND public.is_admin());

DROP POLICY IF EXISTS "admin read tracks bucket" ON storage.objects;
CREATE POLICY "admin read tracks bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'tracks' AND public.is_admin());

-- Storage RLS: system-guides 버킷
DROP POLICY IF EXISTS "admin upload system_guides" ON storage.objects;
CREATE POLICY "admin upload system_guides" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'system-guides' AND public.is_admin());

DROP POLICY IF EXISTS "admin update system_guides" ON storage.objects;
CREATE POLICY "admin update system_guides" ON storage.objects
  FOR UPDATE WITH CHECK (bucket_id = 'system-guides' AND public.is_admin());

DROP POLICY IF EXISTS "admin delete system_guides" ON storage.objects;
CREATE POLICY "admin delete system_guides" ON storage.objects
  FOR DELETE USING (bucket_id = 'system-guides' AND public.is_admin());

DROP POLICY IF EXISTS "public read system_guides bucket" ON storage.objects;
CREATE POLICY "public read system_guides bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'system-guides');

-- PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
