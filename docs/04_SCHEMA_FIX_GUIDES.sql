-- =====================================================
-- AI Music Platform — Schema Fix for Missing Tables
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. profiles 테이블에 active_guide_ids 컬럼 추가 (배열 형태)
alter table public.profiles add column if not exists active_guide_ids text[] default '{}'::text[];

-- 2. user_guides 테이블 생성
create table if not exists public.user_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- 3. Row Level Security (RLS) 활성화
alter table public.user_guides enable row level security;

-- 4. RLS 정책: 본인의 가이드만 조회 가능
drop policy if exists "Users can read own guides" on public.user_guides;
create policy "Users can read own guides"
on public.user_guides for select
using ((select auth.uid()) = user_id);

-- 5. RLS 정책: 본인의 가이드만 추가 가능
drop policy if exists "Users can insert own guides" on public.user_guides;
create policy "Users can insert own guides"
on public.user_guides for insert
with check ((select auth.uid()) = user_id);

-- 6. RLS 정책: 본인의 가이드만 삭제 가능
drop policy if exists "Users can delete own guides" on public.user_guides;
create policy "Users can delete own guides"
on public.user_guides for delete
using ((select auth.uid()) = user_id);

-- 7. RLS 정책: 본인의 가이드만 수정 가능 (필요 시)
drop policy if exists "Users can update own guides" on public.user_guides;
create policy "Users can update own guides"
on public.user_guides for update
using ((select auth.uid()) = user_id);
