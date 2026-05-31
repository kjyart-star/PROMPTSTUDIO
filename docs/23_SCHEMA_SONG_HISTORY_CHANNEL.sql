-- AI Music Platform — Add channel_id to song_history
-- 이 스크립트를 Supabase SQL Editor에서 실행해주세요.

-- 1. song_history 테이블에 channel_id 컬럼 추가 (사용자가 업로드할 때 채널을 지정한 경우 저장)
ALTER TABLE public.song_history ADD COLUMN IF NOT EXISTS channel_id text;
