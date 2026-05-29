-- =====================================================
-- AI Music Platform — 오래된 테스트용 곡 일괄 삭제 (최근 15분 이내 제외)
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 최근 15분 이내에 생성된 최신 곡들을 제외한 모든 과거 기록 삭제
DELETE FROM public.song_history 
WHERE created_at < NOW() - INTERVAL '15 minutes';
