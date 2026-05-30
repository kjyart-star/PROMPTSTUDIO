-- =====================================================
-- 22. Artists Schema Extension
-- =====================================================
-- artists 테이블에 프로필과 동일하게 통계 정보 및 장르(태그) 오버라이드 컬럼을 추가합니다.

DO $$
BEGIN
    -- 1. tags (장르 오버라이드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='artists' AND column_name='tags'
    ) THEN
        ALTER TABLE artists ADD COLUMN tags text[] DEFAULT '{}'::text[];
    END IF;

    -- 2. plays (조회수 오버라이드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='artists' AND column_name='plays'
    ) THEN
        ALTER TABLE artists ADD COLUMN plays integer DEFAULT 0;
    END IF;

    -- 3. likes (좋아요수 오버라이드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='artists' AND column_name='likes'
    ) THEN
        ALTER TABLE artists ADD COLUMN likes integer DEFAULT 0;
    END IF;

    -- 4. followers (팔로워 수 오버라이드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='artists' AND column_name='followers'
    ) THEN
        ALTER TABLE artists ADD COLUMN followers integer DEFAULT 0;
    END IF;

    -- 5. following (팔로잉 수 오버라이드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='artists' AND column_name='following'
    ) THEN
        ALTER TABLE artists ADD COLUMN following integer DEFAULT 0;
    END IF;
END $$;
