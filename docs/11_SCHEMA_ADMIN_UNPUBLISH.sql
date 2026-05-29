-- =====================================================
-- AI Music Platform — Admin Unpublishing Schema Update
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 기존 "Users can manage own playlists" 정책 제거 (SELECT, INSERT, UPDATE, DELETE를 세분화하여 제어하기 위함)
DROP POLICY IF EXISTS "Users can manage own playlists" ON public.user_playlists;
DROP POLICY IF EXISTS "Public can view published playlists" ON public.user_playlists;

-- 1. user_playlists (앨범) 테이블 RLS 정책 재설정
-- 조회: 본인의 앨범이거나, 퍼블리싱(공개)된 앨범만 조회 가능
DROP POLICY IF EXISTS "Users can select own or published playlists" ON public.user_playlists;
CREATE POLICY "Users can select own or published playlists" ON public.user_playlists
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_published = true
  );

-- 추가: 본인의 앨범만 생성 가능
DROP POLICY IF EXISTS "Users can insert own playlists" ON public.user_playlists;
CREATE POLICY "Users can insert own playlists" ON public.user_playlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 삭제: 오직 본인의 앨범만 삭제 가능 (관리자도 삭제는 불가, 퍼블리싱 해제만 가능)
DROP POLICY IF EXISTS "Users can delete own playlists" ON public.user_playlists;
CREATE POLICY "Users can delete own playlists" ON public.user_playlists
  FOR DELETE USING (auth.uid() = user_id);

-- 수정: 본인의 앨범을 수정하거나, 관리자(admin)가 퍼블리싱 상태를 변경할 수 있도록 허용
DROP POLICY IF EXISTS "Users and Admins can update playlists" ON public.user_playlists;
CREATE POLICY "Users and Admins can update playlists" ON public.user_playlists
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- 2. song_history (음원) 테이블의 UPDATE 정책 수정
-- 일반 사용자는 본인 곡만 수정 가능하며, 관리자(admin)는 규정 위반 음원 조치를 위해 어떤 곡이든 수정(비공개 전환) 가능하게 설정
DROP POLICY IF EXISTS "Users can update own song history" ON public.song_history;
DROP POLICY IF EXISTS "Users and Admins can update song history" ON public.song_history;
CREATE POLICY "Users and Admins can update song history" ON public.song_history
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- 3. Supabase API(PostgREST) 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';
