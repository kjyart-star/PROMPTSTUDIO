-- =====================================================
-- AI Music Platform — Storage Inline RLS Policy Fix
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 0. 'tracks' 버킷이 존재하지 않는 경우 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('tracks', 'tracks', false)
ON CONFLICT (id) DO NOTHING;

-- 1. tracks 버킷에 대한 INSERT(업로드) 정책을 인라인으로 정의하여 함수 호출 배제 및 하드코딩된 예외(개발용) 추가
DROP POLICY IF EXISTS "admin upload tracks" ON storage.objects;
CREATE POLICY "admin upload tracks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tracks' AND (
      auth.uid() = 'cb590d8b-7944-4543-b6fd-ae517de687df' OR -- 현재 관리자 계정 ID 직접 허용
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
      )
    )
  );

-- 2. tracks 버킷에 대한 SELECT(조회) 정책도 동일하게 인라인으로 정의
DROP POLICY IF EXISTS "admin read tracks bucket" ON storage.objects;
CREATE POLICY "admin read tracks bucket" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tracks' AND (
      auth.uid() = 'cb590d8b-7944-4543-b6fd-ae517de687df' OR -- 현재 관리자 계정 ID 직접 허용
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
      )
    )
  );

-- 3. PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
