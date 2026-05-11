create table if not exists song_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text default '',
  lyrics text default '',
  notes text default '',
  form jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table song_history enable row level security;

create policy "Users can read own song history"
on song_history for select
using (auth.uid() = user_id);

create policy "Users can insert own song history"
on song_history for insert
with check (auth.uid() = user_id);

create policy "Users can delete own song history"
on song_history for delete
using (auth.uid() = user_id);

-- Profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean default false,
  created_at timestamptz not null default now()
);

-- System Guides table
create table if not exists system_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Announcements table
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);
