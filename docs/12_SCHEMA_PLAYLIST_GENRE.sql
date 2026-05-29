-- =====================================================
-- AI Music Platform — Playlist & Song Genre Schema
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. user_playlists 테이블에 genre 컬럼 추가 (기본 장르/카테고리 강제 선택용)
ALTER TABLE public.user_playlists ADD COLUMN IF NOT EXISTS genre text DEFAULT '';

-- 2. song_history 테이블에 genre 컬럼 추가 (단일 곡 카테고리 지정용)
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS genre text DEFAULT '';

-- Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
