create table if not exists public.song_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text default '',
  lyrics text default '',
  notes text default '',
  form jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.song_history enable row level security;

drop policy if exists "Users can read own song history" on public.song_history;
create policy "Users can read own song history"
on public.song_history for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own song history" on public.song_history;
create policy "Users can insert own song history"
on public.song_history for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own song history" on public.song_history;
create policy "Users can delete own song history"
on public.song_history for delete
using ((select auth.uid()) = user_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
on public.subscriptions for select
using ((select auth.uid()) = user_id);
