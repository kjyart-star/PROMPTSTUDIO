-- =====================================================
-- AI Music Platform — Schema Update (Profile Extensions)
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

DO $$ 
BEGIN
    -- 1. banner_url 컬럼 추가 (배너 이미지 URL)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='banner_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN banner_url text;
    END IF;

    -- 2. bio 컬럼 추가 (소개글)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='bio'
    ) THEN
        ALTER TABLE profiles ADD COLUMN bio text;
    END IF;

    -- 3. tags 컬럼 추가 (태그 목록)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='tags'
    ) THEN
        ALTER TABLE profiles ADD COLUMN tags text[] DEFAULT '{}'::text[];
    END IF;

    -- 4. followers 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='followers'
    ) THEN
        ALTER TABLE profiles ADD COLUMN followers integer DEFAULT 0;
    END IF;

    -- 5. following 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='following'
    ) THEN
        ALTER TABLE profiles ADD COLUMN following integer DEFAULT 0;
    END IF;

    -- 6. plays 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='plays'
    ) THEN
        ALTER TABLE profiles ADD COLUMN plays integer DEFAULT 0;
    END IF;

    -- 7. likes 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='likes'
    ) THEN
        ALTER TABLE profiles ADD COLUMN likes integer DEFAULT 0;
    END IF;

    -- 8. handle 컬럼 추가 (핸들 네임, 예: @ostdreamer)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='handle'
    ) THEN
        ALTER TABLE profiles ADD COLUMN handle text;
    END IF;
END $$;
