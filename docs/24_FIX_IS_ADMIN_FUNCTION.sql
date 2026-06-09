-- =====================================================
-- AI Music Platform — Admin & Storage RLS Fix Patch
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. is_admin() 함수를 profiles 테이블 기준으로 확실히 갱신
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- 2. Storage objects RLS 정책 갱신 (tracks 버킷 관리자 업로드 권한)
DROP POLICY IF EXISTS "admin upload tracks" ON storage.objects;
CREATE POLICY "admin upload tracks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tracks' AND 
    public.is_admin()
  );

DROP POLICY IF EXISTS "admin read tracks bucket" ON storage.objects;
CREATE POLICY "admin read tracks bucket" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tracks' AND 
    public.is_admin()
  );

-- 3. Storage objects RLS 정책 갱신 (avatars 버킷 일반 유저 업로드 권한)
DROP POLICY IF EXISTS "public read avatars bucket" ON storage.objects;
CREATE POLICY "public read avatars bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users can upload avatars" ON storage.objects;
CREATE POLICY "users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "users can update own avatars" ON storage.objects;
CREATE POLICY "users can update own avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "users can delete own avatars" ON storage.objects;
CREATE POLICY "users can delete own avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND owner = auth.uid());

-- 4. song_history 테이블 RLS 및 INSERT 정책 재확인
ALTER TABLE public.song_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own song history" ON public.song_history;
CREATE POLICY "Users can read own song history" ON public.song_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own song history" ON public.song_history;
CREATE POLICY "Users can insert own song history" ON public.song_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and Admins can update song history" ON public.song_history;
CREATE POLICY "Users and Admins can update song history" ON public.song_history
  FOR UPDATE USING (
    auth.uid() = user_id OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Users can delete own song history" ON public.song_history;
CREATE POLICY "Users can delete own song history" ON public.song_history
  FOR DELETE USING (auth.uid() = user_id);

-- 5. PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
