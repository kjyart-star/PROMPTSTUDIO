-- =====================================================
-- AI Music Platform — Profile Upload Setup
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. profiles 테이블 컬럼 추가
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='display_name') THEN
        ALTER TABLE profiles ADD COLUMN display_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url text;
    END IF;

    -- 이전 퍼블리싱 기능을 위해 song_history 컬럼도 한번 더 확인
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='song_history' AND column_name='is_published') THEN
        ALTER TABLE song_history ADD COLUMN is_published boolean DEFAULT false;
    END IF;
END $$;

-- 2. Storage 버킷 생성 (avatars)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Storage RLS 정책 (아바타 업로드 권한 설정)
-- 아바타는 public 버킷이므로 누구나 읽을 수 있음
drop policy if exists "public read avatars bucket" on storage.objects;
create policy "public read avatars bucket" on storage.objects
  for select using (bucket_id = 'avatars');

-- 인증된 사용자는 아바타 버킷에 이미지를 업로드할 수 있음
drop policy if exists "users can upload avatars" on storage.objects;
create policy "users can upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- 본인이 올린 아바타 이미지는 업데이트/삭제할 수 있음
drop policy if exists "users can update own avatars" on storage.objects;
create policy "users can update own avatars" on storage.objects
  for update using (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "users can delete own avatars" on storage.objects;
create policy "users can delete own avatars" on storage.objects
  for delete using (bucket_id = 'avatars' and owner = auth.uid());
